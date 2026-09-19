#!/usr/bin/env node
/**
 * Emit actor-readable state from the active sprint file.
 *
 * The one sprint-markdown parser: --format json is the wire contract
 * (schema_version 2) is the fresh-session recovery rail (`--json`), --format text is the human surface
 * next.sh / status.sh exec into. The shell scripts only plumb arguments.
 */

const fs = require("fs");
const path = require("path");
const {
  parseSimpleYaml,
  scopesOverlap,
  containsIssueRef,
  parsePlanCheckbox, readTaskAuthority,
  DEFAULT_BACKLOG_DIR,
} = require("./lib.js");

// v2 (multi-track): adds `active_sprints[]`; `active_sprint` + the top-level
// single-sprint fields are retained (sole element when exactly one is active,
// null when a portfolio) so v1 consumers keep working. See PRD §5.2 / R5.
const SCHEMA_VERSION = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Legacy `[run:…]` pointers (deprecated relay, 2026-09-19) are stripped and ignored.
const LEGACY_RUN_RE = /\s*\[run:[^\]]+\]$/;
const BRANCH_RE = /\[branch:([^\]\s]+)\]/;
const PR_RE = /→ PR #(\d+) \((\w+)\)$/;
const PROGRESS_DATE_RE = /^-\s+(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?:/;

const STATE_BY_MARKER = {
  " ": "todo",
  "~": "in_flight",
  x: "done",
};

function usage() {
  return "Usage: sprint-state.js [--mode status|next] [--format json|text]"
    + " [--track slug | --component slug] [backlog-dir]";
}

function parseArgs(args) {
  const options = {
    mode: "status",
    format: "json",
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
    for (const [name, key] of [["track", "track"], ["component", "component"], ["format", "format"]]) {
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

  if (!["json", "text"].includes(options.format)) {
    return { ...options, error: `Invalid --format: ${options.format}. ${usage()}` };
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

function parsePlanItems(planLines) {
  const items = [];
  let batchHeading = null;

  for (const line of planLines) {
    if (/^### Batch/.test(line)) {
      batchHeading = line;
      continue;
    }

    const item = parsePlanItem(line, batchHeading);
    if (item) items.push(item);
  }

  return items;
}

function parsePlanItem(line, batchHeading = null) {
  const checkbox = parsePlanCheckbox(line);
  if (!checkbox) return null;

  const checkboxState = checkbox.checkboxState;
  const identity = checkbox.identity;
  let title = checkbox.title.replace(LEGACY_RUN_RE, "").trim();

  const branchMatch = line.match(BRANCH_RE);
  const branch = branchMatch ? branchMatch[1] : null;

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
    issue_number: identity.issue_number,
    title,
    batch_heading: batchHeading,
    pr,
    branch,
    unmoored: state === "in_flight" && !pr && !branch,
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
    .filter((entry) => entry.date && containsIssueRef(entry.line, identity))
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
  today = new Date(), authority = "github",
}) {
  const frontmatter = parseFrontmatter(content);
  const goal = extractSectionLines(content, "Goal").join("\n").trim();
  const planItems = parsePlanItems(extractSectionLines(content, "Plan"));
  for (const item of planItems) item.tracker = authority; // #476: declared authority wins
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
  const authority = readTaskAuthority(backlogDir); // #476: read once per run
  const activeFiles = findActiveSprintFiles(sprintsDir, {
    existsSync,
    readdirSync,
    readFileSync,
  });

  if (activeFiles.length === 0) return emptyState();

  const perSprints = activeFiles
    .map((sprintPath) => parseSprintContent({
      sprintPath,
      content: readFileSync(sprintPath, "utf-8"),
      today,
      authority,
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

// ---------------------------------------------------------------------------
// Text rendering. The shape next.sh / status.sh printed in bash before #468,
// on JSON semantics (Plan-only counts, started-ordered portfolio, fail-loud
// overlap, trimmed trailing blanks). The shell scripts exec `--format text`.
// ---------------------------------------------------------------------------

const NO_SPRINT_HINT = "List open tasks in the task authority.";

function countStates(planItems) {
  const count = (state) => planItems.filter((item) => item.state === state).length;
  return {
    done: count("done"),
    in_flight: count("in_flight"),
    todo: count("todo"),
    total: planItems.length,
  };
}

function isReadyToClose(counts) {
  return counts.todo === 0 && counts.in_flight === 0 && counts.total > 0;
}

function percentDone(counts) {
  return counts.total > 0 ? Math.floor((counts.done * 100) / counts.total) : 0;
}

// Plan lines render verbatim (the checkbox line is the display form).
function itemLines(planItems, state, limit = Infinity) {
  return planItems
    .filter((item) => item.state === state)
    .slice(0, limit)
    .map((item) => `  ${item.line}`);
}

function goalLines(goal) {
  if (!goal) return [];
  return goal.split("\n").slice(0, 3).map((line) => line.replace(/^ +/, ""));
}

function progressLine(counts) {
  const detail = counts.in_flight > 0
    ? `${counts.in_flight} in-flight, ${counts.todo} remaining`
    : `${counts.todo} remaining`;
  return `Progress: ${counts.done}/${counts.total} done (${detail})`;
}

// A batch-less plan lists every todo; no todos still prints the bare header
// (bash parity — the sprint is then all in-flight or empty).
function nextBatchLines(nextBatch) {
  const heading = nextBatch ? nextBatch.heading : null;
  const items = nextBatch ? nextBatch.items : [];
  return [
    heading ? `Next: ${heading}` : "Next items:",
    ...items.map((item) => `  ${item.line}`),
  ];
}

function nextSingleLines(perSprint) {
  const counts = countStates(perSprint.plan_items);
  const lines = [`=== Sprint: ${sprintSlug(perSprint.active_sprint.path)} ===`, ""];
  const goal = goalLines(perSprint.active_sprint.goal);
  if (goal.length > 0) lines.push(`Goal: ${goal[0]}`, ...goal.slice(1), "");
  lines.push(progressLine(counts), "");
  if (isReadyToClose(counts)) return [...lines, "All items checked! Ready to close sprint."];
  if (counts.in_flight > 0) {
    lines.push("In flight:", ...itemLines(perSprint.plan_items, "in_flight"), "");
  }
  lines.push(...nextBatchLines(perSprint.next_batch), "");
  const last = perSprint.latest_progress[0];
  return last ? [...lines, `Last: ${last.line}`] : lines;
}

function nextTrackLines(perSprint) {
  const counts = countStates(perSprint.plan_items);
  const inFlight = counts.in_flight > 0 ? `, ${counts.in_flight} in-flight` : "";
  const slug = sprintSlug(perSprint.active_sprint.path);
  const lines = [`${slug}: ${counts.done}/${counts.total} done${inFlight}`];
  const todo = perSprint.plan_items.find((item) => item.state === "todo");
  if (todo) lines.push(`  Next: ${todo.line.replace(/^- \[ \] /, "")}`);
  return lines;
}

function nextPortfolioLines(perSprints) {
  return [
    `=== ${perSprints.length} active tracks (portfolio) ===`,
    "",
    ...perSprints.flatMap((perSprint) => nextTrackLines(perSprint)),
    "",
    "Use 'next.sh --track <slug>' for a single track.",
  ];
}

function statusCountLine(perSprint, { indent = "", unit = "" } = {}) {
  const counts = countStates(perSprint.plan_items);
  const inFlight = counts.in_flight > 0 ? ` — ${counts.in_flight} in-flight` : "";
  const slug = sprintSlug(perSprint.active_sprint.path);
  return `${indent}${slug}: ${counts.done}/${counts.total}${unit}`
    + ` (${percentDone(counts)}%)${inFlight}`;
}

function statusSingleLines(perSprint) {
  const counts = countStates(perSprint.plan_items);
  const lines = [statusCountLine(perSprint, { unit: " tasks" })];
  const inFlight = itemLines(perSprint.plan_items, "in_flight", 3);
  if (inFlight.length > 0) lines.push("", "In flight:", ...inFlight);
  const todo = itemLines(perSprint.plan_items, "todo", 3);
  if (todo.length > 0) lines.push("", "Next up:", ...todo);
  if (isReadyToClose(counts)) lines.push("", ">> All items done — ready to close sprint");
  return lines;
}

function statusPortfolioLines(perSprints) {
  return [
    `${perSprints.length} active tracks (portfolio):`,
    ...perSprints.map((perSprint) => statusCountLine(perSprint, { indent: "  " })),
  ];
}

function noTrackReport(sprintsDir, selector) {
  const slugs = findActiveSprintFiles(sprintsDir).map(sprintSlug);
  return {
    lines: [
      `No active track matches '${selector}'. Active tracks:`,
      ...slugs.map((slug) => `  - ${slug}`),
    ],
    code: 1,
  };
}

function nextReport(options, sprintsDir, selector) {
  if (!fs.existsSync(sprintsDir)) {
    return { lines: [`No ${sprintsDir} directory. Run setup-dev-backlog.js first.`], code: 1 };
  }
  const state = readSprintState(options);
  if (state.active_sprints.length === 0) {
    if (selector) return noTrackReport(sprintsDir, selector);
    return { lines: ["No active sprint found.", NO_SPRINT_HINT], code: 0 };
  }
  const lines = state.active_sprint
    ? nextSingleLines(state)
    : nextPortfolioLines(state.active_sprints);
  return { lines, code: 0 };
}

function statusReport(options, sprintsDir, selector) {
  const header = "=== Active Sprint ===";
  if (!fs.existsSync(sprintsDir)) {
    return { lines: [header, `(no ${sprintsDir}/ directory)`], code: 0 };
  }
  const state = readSprintState(options);
  if (state.active_sprints.length === 0) {
    const empty = selector ? `(no active track matches '${selector}')` : "(no active sprint)";
    return { lines: [header, empty], code: 0 };
  }
  const body = state.active_sprint
    ? statusSingleLines(state)
    : statusPortfolioLines(state.active_sprints);
  return { lines: [header, ...body], code: 0 };
}

// { lines, code } so the caller owns printing and the exit status.
function textReport(options) {
  const sprintsDir = path.join(options.backlogDir || DEFAULT_BACKLOG_DIR, "sprints");
  const selector = options.track || options.component || null;
  return options.mode === "next"
    ? nextReport(options, sprintsDir, selector)
    : statusReport(options, sprintsDir, selector);
}

function trimTrailingBlanks(lines) {
  const out = [...lines];
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out;
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
    if (parsed.format === "text") {
      const report = textReport(parsed);
      const text = trimTrailingBlanks(report.lines).join("\n");
      if (text) console.log(text);
      process.exitCode = report.code;
      return;
    }
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
  textReport,
};
