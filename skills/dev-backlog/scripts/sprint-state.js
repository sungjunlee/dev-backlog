#!/usr/bin/env node
/**
 * Emit actor-readable state from the active sprint file.
 *
 * Human status/next output stays in the shell scripts; their --json paths
 * delegate here so markdown parsing for structured reads has one owner.
 */

const fs = require("fs");
const path = require("path");
const { parseSimpleYaml, readConfig, scopesOverlap } = require("./lib.js");
const {
  containsTaskRef,
  githubIssueNumber,
  parsePlanCheckbox,
} = require("./task-ref.js");

// v2 (multi-track): adds `active_sprints[]`; `active_sprint` + the top-level
// single-sprint fields are retained (sole element when exactly one is active,
// null when a portfolio) so v1 consumers keep working. See PRD §5.2 / R5.
const SCHEMA_VERSION = 2;
const DEFAULT_BACKLOG_DIR = "backlog";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const RUN_ID_RE = /\[run:([^\]]+)\]$/;
const BRANCH_RE = /\[branch:([^\]\s]+)\]/;
const PR_RE = /→ PR #(\d+) \((\w+)\)$/;
const PROGRESS_DATE_RE = /^-\s+(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?:/;

const STATE_BY_MARKER = {
  " ": "todo",
  "~": "in_flight",
  x: "done",
};

function usage() {
  return "Usage: sprint-state.js [--mode status|next] [--track slug | --component slug] [backlog-dir]";
}

function parseArgs(args) {
  const options = {
    mode: "status",
    backlogDir: DEFAULT_BACKLOG_DIR,
    track: null,
    component: null,
  };
  let backlogDirSet = false;

  const valueFlag = (arg, i, name, key) => {
    if (arg === `--${name}`) {
      const next = args[i + 1];
      if (!next) return { consumed: 1, error: `Missing value for --${name}. ${usage()}` };
      options[key] = next;
      return { consumed: 2 };
    }
    if (arg.startsWith(`--${name}=`)) {
      options[key] = arg.slice(`--${name}=`.length);
      return { consumed: 1 };
    }
    return null;
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
    if (arg === "--json") continue;
    if (arg === "--mode") {
      const next = args[i + 1];
      if (!next) return { ...options, error: `Missing value for --mode. ${usage()}` };
      options.mode = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--mode=")) {
      options.mode = arg.slice("--mode=".length);
      continue;
    }
    let handled = false;
    for (const [name, key] of [["track", "track"], ["component", "component"]]) {
      const res = valueFlag(arg, i, name, key);
      if (res) {
        if (res.error) return { ...options, error: res.error };
        i += res.consumed - 1;
        handled = true;
        break;
      }
    }
    if (handled) continue;
    if (arg.startsWith("--")) {
      return { ...options, error: `Unknown argument: ${arg}. ${usage()}` };
    }
    if (backlogDirSet) {
      return { ...options, error: `Unexpected argument: ${arg}. ${usage()}` };
    }
    options.backlogDir = arg;
    backlogDirSet = true;
  }

  if (!["status", "next"].includes(options.mode)) {
    return { ...options, error: `Invalid --mode: ${options.mode}. ${usage()}` };
  }

  if (options.track && options.component) {
    return { ...options, error: `Use only one of --track / --component. ${usage()}` };
  }

  return options;
}

// Per-sprint fields shared by the single and portfolio shapes. Kept null/empty
// at the top level of a portfolio (N>1) so v1 consumers that read
// active_sprint/plan_items degrade to "no single active sprint".
function emptyTopLevel() {
  return {
    active_sprint: null,
    plan_items: [],
    next_batch: null,
    latest_progress: [],
    in_flight: [],
  };
}

function emptyState() {
  return {
    schema_version: SCHEMA_VERSION,
    active_sprints: [],
    ...emptyTopLevel(),
  };
}

// One active track: retain the v1 top-level fields (back-compat) and also list
// it under active_sprints[].
function singleState(perSprint) {
  return {
    schema_version: SCHEMA_VERSION,
    active_sprints: [perSprint],
    ...perSprint,
  };
}

// N disjoint active tracks: the portfolio. Top-level singular fields are
// null/empty; consumers read active_sprints[] or pass --track/--component.
function portfolioState(perSprints) {
  return {
    schema_version: SCHEMA_VERSION,
    active_sprints: perSprints,
    ...emptyTopLevel(),
  };
}

function findActiveSprintFiles(sprintsDir, {
  existsSync = fs.existsSync,
  readdirSync = fs.readdirSync,
  readFileSync = fs.readFileSync,
} = {}) {
  if (!existsSync(sprintsDir)) return [];

  return readdirSync(sprintsDir)
    .filter((file) => file.endsWith(".md") && file !== "_context.md")
    .map((file) => path.join(sprintsDir, file))
    .filter((filePath) => {
      const content = readFileSync(filePath, "utf-8");
      return /^status:\s*active\s*$/m.test(content);
    })
    .sort();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  return parseSimpleYaml(match[1]);
}

function extractSectionLines(content, section) {
  const lines = content.split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRegExp(section)}[ \\t]*$`);
  const out = [];
  let found = false;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (found) break;
      if (sectionRe.test(line)) {
        found = true;
      }
      continue;
    }
    if (found) out.push(line);
  }

  while (out.length > 0 && out[0].trim() === "") out.shift();
  while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  return out;
}

function hasSection(content, section) {
  const sectionRe = new RegExp(`^## ${escapeRegExp(section)}[ \\t]*$`);
  return content.split(/\r?\n/).some((line) => sectionRe.test(line));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseProgressEntries(progressLines) {
  return progressLines
    .filter((line) => line.startsWith("- "))
    .map((line) => {
      const dateMatch = line.match(PROGRESS_DATE_RE);
      return {
        line,
        date: dateMatch ? dateMatch[1] : null,
      };
    });
}

function parsePlanItems(planLines, options = {}) {
  const items = [];
  let batchHeading = null;

  for (const line of planLines) {
    if (/^### Batch/.test(line)) {
      batchHeading = line;
      continue;
    }

    const item = parsePlanItem(line, batchHeading, options);
    if (item) items.push(item);
  }

  return items;
}

function parsePlanItem(line, batchHeading = null, options = {}) {
  const checkbox = parsePlanCheckbox(line, options);
  if (!checkbox) return null;

  const checkboxState = checkbox.checkboxState;
  const identity = checkbox.identity;
  let title = checkbox.title;

  const runMatch = line.match(RUN_ID_RE);
  const runId = runMatch ? runMatch[1] : null;
  const branchMatch = line.match(BRANCH_RE);
  const branch = branchMatch ? branchMatch[1] : null;

  if (runId) title = title.replace(/\s*\[run:[^\]]+\]$/, "").trim();
  if (branch) title = title.replace(/\s*\[branch:[^\]\s]+\]/g, "").trim();

  const prMatch = title.match(PR_RE);
  const pr = prMatch
    ? { number: Number.parseInt(prMatch[1], 10), state: prMatch[2] }
    : null;
  if (prMatch) title = title.slice(0, prMatch.index).trim();

  const state = STATE_BY_MARKER[checkboxState];

  return {
    line,
    checkbox_state: checkboxState,
    state,
    tracker: identity.tracker,
    id: identity.id,
    ref: identity.ref,
    issue_number: githubIssueNumber(identity),
    title,
    batch_heading: batchHeading,
    pr,
    run_id: runId,
    branch,
    unmoored: state === "in_flight" && !pr && !runId && !branch,
  };
}

function findNextBatch(planItems) {
  const firstTodo = planItems.find((item) => item.state === "todo");
  if (!firstTodo) return null;

  if (!firstTodo.batch_heading) {
    return {
      heading: null,
      items: planItems.filter((item) => item.state === "todo"),
    };
  }

  return {
    heading: firstTodo.batch_heading,
    items: planItems.filter(
      (item) => item.state === "todo" && item.batch_heading === firstTodo.batch_heading
    ),
  };
}

function formatLocalDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateToUtcMs(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(startDate, endDate) {
  return Math.max(0, Math.floor((dateToUtcMs(endDate) - dateToUtcMs(startDate)) / MS_PER_DAY));
}

function computeAge(identityOrIssueNumber, progressEntries, startedDate, today) {
  const identity = typeof identityOrIssueNumber === "number"
    ? { tracker: "github", id: String(identityOrIssueNumber), ref: `#${identityOrIssueNumber}` }
    : identityOrIssueNumber;
  const progressDates = progressEntries
    .filter((entry) => entry.date && containsTaskRef(entry.line, identity))
    .map((entry) => entry.date)
    .sort();

  let basisDate = null;
  let source = null;
  if (progressDates.length > 0) {
    basisDate = progressDates[0];
    source = "progress";
  } else if (isDateString(startedDate)) {
    basisDate = startedDate;
    source = "started";
  }

  if (!basisDate) {
    return {
      age_days: null,
      age_source: null,
      age_basis_date: null,
    };
  }

  return {
    age_days: daysBetween(basisDate, formatLocalDate(today)),
    age_source: source,
    age_basis_date: basisDate,
  };
}

function parseSprintContent({
  sprintPath,
  content,
  today = new Date(),
  taskPrefix = "BACK",
}) {
  const frontmatter = parseFrontmatter(content);
  const goal = extractSectionLines(content, "Goal").join("\n").trim();
  const planItems = parsePlanItems(extractSectionLines(content, "Plan"), { taskPrefix });
  const progressEntries = parseProgressEntries(extractSectionLines(content, "Progress"));
  const nextBatch = findNextBatch(planItems);
  const inFlight = planItems
    .filter((item) => item.state === "in_flight")
    .map((item) => ({
      ...item,
      ...computeAge(item, progressEntries, frontmatter.started, today),
    }));

  // Per-sprint state (no schema_version — that lives on the top-level wrapper).
  return {
    active_sprint: {
      path: sprintPath,
      frontmatter,
      goal,
    },
    plan_items: planItems,
    next_batch: nextBatch,
    latest_progress: progressEntries.slice(-5).reverse(),
    in_flight: inFlight,
  };
}

function sprintSlug(sprintPath) {
  return path.basename(sprintPath, ".md");
}

// Ascending by frontmatter `started:` (D4), filename as a stable tiebreaker.
function comparePerSprint(a, b) {
  const sa = a.active_sprint.frontmatter.started || "";
  const sb = b.active_sprint.frontmatter.started || "";
  if (sa !== sb) return sa < sb ? -1 : 1;
  return a.active_sprint.path < b.active_sprint.path ? -1 : 1;
}

function matchesSelector(perSprint, { track, component }) {
  const fm = perSprint.active_sprint.frontmatter || {};
  const fmComponent = typeof fm.component === "string" ? fm.component.trim() : "";
  if (component) return fmComponent === component;
  // --track matches the sprint slug or its component handle.
  return sprintSlug(perSprint.active_sprint.path) === track || fmComponent === track;
}

function firstOverlappingPair(perSprints) {
  for (let i = 0; i < perSprints.length; i += 1) {
    for (let j = i + 1; j < perSprints.length; j += 1) {
      if (scopesOverlap(
        perSprints[i].active_sprint.frontmatter,
        perSprints[j].active_sprint.frontmatter
      )) {
        return [perSprints[i], perSprints[j]];
      }
    }
  }
  return null;
}

function readSprintState({
  backlogDir = DEFAULT_BACKLOG_DIR,
  today = new Date(),
  track = null,
  component = null,
  existsSync = fs.existsSync,
  readdirSync = fs.readdirSync,
  readFileSync = fs.readFileSync,
} = {}) {
  const sprintsDir = path.join(backlogDir, "sprints");
  const activeFiles = findActiveSprintFiles(sprintsDir, {
    existsSync,
    readdirSync,
    readFileSync,
  });

  if (activeFiles.length === 0) return emptyState();

  const taskPrefix = readConfig(backlogDir).task_prefix;
  const perSprints = activeFiles
    .map((sprintPath) => parseSprintContent({
      sprintPath,
      content: readFileSync(sprintPath, "utf-8"),
      today,
      taskPrefix,
    }))
    .sort(comparePerSprint);

  // Explicit track/component selector: resolve to that one track deterministically.
  if (track || component) {
    const matches = perSprints.filter((s) => matchesSelector(s, { track, component }));
    if (matches.length === 0) return emptyState();
    return singleState(matches[0]);
  }

  if (perSprints.length === 1) return singleState(perSprints[0]);

  // N active tracks: a portfolio when scopes are disjoint; fail loud on overlap.
  const overlap = firstOverlappingPair(perSprints);
  if (overlap) {
    const [a, b] = overlap;
    const error = new Error(
      `Active tracks overlap on scope:\n  ${a.active_sprint.path}\n  ${b.active_sprint.path}\n`
      + "Give them disjoint component:/scope: or close one before continuing."
    );
    error.code = "OVERLAPPING_TRACKS";
    error.files = [a.active_sprint.path, b.active_sprint.path];
    throw error;
  }
  return portfolioState(perSprints);
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(parsed.error);
    process.exit(1);
  }
  if (parsed.help) {
    console.log(usage());
    return;
  }

  try {
    const state = readSprintState({
      backlogDir: parsed.backlogDir,
      track: parsed.track,
      component: parsed.component,
    });
    console.log(JSON.stringify(state, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  SCHEMA_VERSION,
  parseArgs,
  findActiveSprintFiles,
  parseFrontmatter,
  extractSectionLines,
  hasSection,
  parseProgressEntries,
  parsePlanItem,
  parsePlanItems,
  findNextBatch,
  computeAge,
  parseSprintContent,
  readSprintState,
};
