#!/usr/bin/env node
/**
 * Emit actor-readable state from the active sprint file.
 *
 * The one sprint-markdown parser: --format json (schema_version 3) is the
 * fresh-session recovery rail; --format text is the
 * human surface for next/status orientation.
 */

const fs = require("fs");
const path = require("path");
const {
  parseSimpleYaml,
  scopesOverlap,
  parsePlanCheckbox,
  DEFAULT_BACKLOG_DIR,
} = require("./lib.js");

// v3 is only the portfolio: each active_sprints[] entry is one complete track.
const SCHEMA_VERSION = 3;

const BRANCH_RE = /\[branch:([^\]\s]+)\]/;
const PR_RE = /→ PR #(\d+) \((\w+)\)$/;
const PROGRESS_DATE_RE = /^-\s+(\d{4}-\d{2}-\d{2})(?:\s+\d{2}:\d{2})?:/;
const PLAN_ITEM_SOURCE = Symbol("planItemSource");

const STATE_BY_MARKER = {
  " ": "todo",
  "~": "in_flight",
  x: "done",
};

function usage() {
  return "Usage: sprint-state.js [--mode status|next] [--format json|text]"
    + " [--track slug] [backlog-dir]";
}

function parseArgs(args) {
  const options = {
    mode: "status",
    format: "json",
    backlogDir: DEFAULT_BACKLOG_DIR,
    track: null,
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
    for (const [name, key] of [["track", "track"], ["format", "format"]]) {
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

  return options;
}

function emptyState() {
  return {
    schema_version: SCHEMA_VERSION,
    active_sprints: [],
  };
}

function stateForTracks(tracks) {
  return {
    schema_version: SCHEMA_VERSION,
    active_sprints: tracks,
  };
}

function findActiveSprintFiles(sprintsDir, {
  existsSync = fs.existsSync,
  readdirSync = fs.readdirSync,
  readFileSync = fs.readFileSync,
  statSync = fs.statSync,
} = {}) {
  if (!existsSync(sprintsDir)) return [];

  return readdirSync(sprintsDir)
    .filter((file) => file.endsWith(".md") && file !== "_context.md")
    .map((file) => path.join(sprintsDir, file))
    // A directory or dangling link named *.md is not a sprint; other read
    // errors (permissions) still throw.
    .filter((filePath) => {
      try {
        return statSync(filePath).isFile();
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    })
    .filter((filePath) => {
      const content = readFileSync(filePath, "utf-8");
      return isActiveSprint(content);
    })
    .sort();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  return parseSimpleYaml(match[1]);
}

function isActiveSprint(content) {
  const status = parseFrontmatter(content).status;
  return typeof status === "string" && status.trim() === "active";
}

function extractSectionLineRecords(content, section) {
  const lines = content.split(/\r?\n/);
  const sectionRe = new RegExp(`^## ${escapeRegExp(section)}[ \\t]*$`);
  const out = [];
  let found = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) {
      if (found) break;
      if (sectionRe.test(line)) {
        found = true;
      }
      continue;
    }
    if (found) out.push({ line, line_number: index + 1 });
  }

  while (out.length > 0 && out[0].line.trim() === "") out.shift();
  while (out.length > 0 && out[out.length - 1].line.trim() === "") out.pop();
  return out;
}

function extractSectionLines(content, section) {
  return extractSectionLineRecords(content, section).map(({ line }) => line);
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

// The Plan contract is intentionally narrow: blank lines, current ###
// headings, and the one checkbox grammar. Recovery and doctor share this rule.
function findUnparseablePlanLines(content) {
  return extractSectionLineRecords(content, "Plan")
    .map((record, index) => ({ ...record, plan_line: index + 1 }))
    .filter(({ line }) => line.trim() !== "")
    .filter(({ line }) => !/^###\s+/.test(line))
    .filter(({ line }) => parsePlanItem(line) === null);
}

function invalidPlanError(sprintPath, lines) {
  const locations = lines
    .map(({ line_number: lineNumber }) => `${sprintPath}:${lineNumber}`)
    .join(", ");
  const error = new Error(
    `Invalid active Plan at ${locations}. `
    + "Repair: correct the source Plan; do not continue from a partial or normalized projection."
  );
  error.code = "INVALID_ACTIVE_PLAN";
  error.file = sprintPath;
  error.plan_lines = lines;
  return error;
}

function parsePlanItems(planLines) {
  const items = [];
  let batchHeading = null;
  let batchIndex = null;

  for (const line of planLines) {
    if (/^### Batch/.test(line)) {
      batchHeading = line;
      batchIndex = batchIndex === null ? 0 : batchIndex + 1;
      continue;
    }

    const item = parsePlanItem(line, batchHeading);
    if (item) {
      item[PLAN_ITEM_SOURCE].batch_index = batchIndex;
      items.push(item);
    }
  }

  return items;
}

function parsePlanItem(line, batchHeading = null) {
  const checkbox = parsePlanCheckbox(line);
  if (!checkbox) return null;

  const checkboxState = checkbox.checkboxState;
  const identity = checkbox.identity;
  let title = checkbox.title.trim();

  const branchMatch = line.match(BRANCH_RE);
  const branch = branchMatch ? branchMatch[1] : null;

  if (branch) title = title.replace(/\s*\[branch:[^\]\s]+\]/g, "").trim();

  const prMatch = title.match(PR_RE);
  const pr = prMatch
    ? { number: Number.parseInt(prMatch[1], 10), state: prMatch[2] }
    : null;
  if (prMatch) title = title.slice(0, prMatch.index).trim();

  const state = STATE_BY_MARKER[checkboxState];

  const item = {
    ref: identity.ref,
    state,
    title,
    pointer: pr || branch ? { pr, branch } : null,
  };
  Object.defineProperty(item, PLAN_ITEM_SOURCE, {
    value: { line, checkbox_state: checkboxState, batch_heading: batchHeading, batch_index: null },
  });
  return item;
}

function findNextBatch(planItems) {
  const firstTodo = planItems.find((item) => item.state === "todo");
  if (!firstTodo) return null;

  if (!firstTodo[PLAN_ITEM_SOURCE].batch_heading) {
    return {
      heading: null,
      items: planItems.filter((item) => item.state === "todo"),
      waiting_on: [],
      actionable: true,
    };
  }

  // Batches are identified by position, not heading text, so a repeated
  // heading cannot merge two batches.
  const batch = firstTodo[PLAN_ITEM_SOURCE].batch_index;
  const waitingOn = planItems.filter((item) =>
    item.state === "in_flight"
    && item[PLAN_ITEM_SOURCE].batch_index !== null
    && item[PLAN_ITEM_SOURCE].batch_index < batch
  ).map((item) => item.ref);

  return {
    heading: firstTodo[PLAN_ITEM_SOURCE].batch_heading,
    items: planItems.filter(
      (item) => item.state === "todo" && item[PLAN_ITEM_SOURCE].batch_index === batch
    ),
    waiting_on: waitingOn,
    actionable: waitingOn.length === 0,
  };
}

function parseSprintContent({
  sprintPath,
  content,
}) {
  const unparseable = findUnparseablePlanLines(content);
  if (unparseable.length > 0) throw invalidPlanError(sprintPath, unparseable);

  const frontmatter = parseFrontmatter(content);
  const goal = extractSectionLines(content, "Goal").join("\n").trim();
  const planItems = parsePlanItems(extractSectionLines(content, "Plan"));
  const progressEntries = parseProgressEntries(extractSectionLines(content, "Progress"));
  const nextBatch = findNextBatch(planItems);
  const inFlight = planItems.filter((item) => item.state === "in_flight");

  // Per-track state (schema_version lives on the top-level wrapper).
  return {
    path: sprintPath,
    frontmatter,
    goal,
    plan_items: planItems,
    next_batch: nextBatch,
    in_flight: inFlight,
    latest_progress: progressEntries.slice(-5).reverse(),
  };
}

function sprintSlug(sprintPath) {
  return path.basename(sprintPath, ".md");
}

// Ascending by frontmatter `started:` (D4), filename as a stable tiebreaker.
function compareTrackRecords(a, b) {
  const sa = a.frontmatter.started || "";
  const sb = b.frontmatter.started || "";
  if (sa !== sb) return sa < sb ? -1 : 1;
  return a.path < b.path ? -1 : 1;
}

function matchesSelector(trackRecord, track) {
  const fm = trackRecord.frontmatter || {};
  const fmComponent = typeof fm.component === "string" ? fm.component.trim() : "";
  // --track matches the sprint slug or its component handle.
  return sprintSlug(trackRecord.path) === track || fmComponent === track;
}

function firstOverlappingPair(trackRecords) {
  for (let i = 0; i < trackRecords.length; i += 1) {
    for (let j = i + 1; j < trackRecords.length; j += 1) {
      if (scopesOverlap(trackRecords[i].frontmatter, trackRecords[j].frontmatter)) {
        return [trackRecords[i], trackRecords[j]];
      }
    }
  }
  return null;
}

// One shared active-track read for recovery and doctor: discovery, parse,
// ordering, Plan validity capture, and overlap search all happen here.
function readActiveTracks(sprintsDir, {
  existsSync = fs.existsSync,
  readdirSync = fs.readdirSync,
  readFileSync = fs.readFileSync,
  statSync = fs.statSync,
} = {}) {
  const tracks = findActiveSprintFiles(sprintsDir, {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
  }).map((sprintPath) => {
    const content = readFileSync(sprintPath, "utf-8");
    const record = {
      path: sprintPath,
      slug: sprintSlug(sprintPath),
      frontmatter: parseFrontmatter(content),
      content,
      track: null,
      error: null,
    };
    try {
      record.track = parseSprintContent({ sprintPath, content });
    } catch (error) {
      record.error = error;
    }
    return record;
  }).sort(compareTrackRecords);
  return { tracks, overlap: firstOverlappingPair(tracks) };
}

function readSprintState({
  backlogDir = DEFAULT_BACKLOG_DIR,
  track = null,
  existsSync = fs.existsSync,
  readdirSync = fs.readdirSync,
  readFileSync = fs.readFileSync,
  statSync = fs.statSync,
} = {}) {
  const sprintsDir = path.join(backlogDir, "sprints");
  const portfolio = readActiveTracks(sprintsDir, {
    existsSync,
    readdirSync,
    readFileSync,
    statSync,
  });
  const records = portfolio.tracks;

  if (records.length === 0) return emptyState();

  const invalid = records.find((record) => record.error);
  if (invalid) throw invalid.error;

  // Explicit track selector: resolve slug or component handle deterministically.
  if (track) {
    const matches = records.filter((record) => matchesSelector(record, track));
    if (matches.length === 0) return emptyState();
    if (matches.length > 1) {
      throw new Error(`Ambiguous active track '${track}':\n`
        + matches.map((record) => `  ${record.path}`).join("\n"));
    }
    return stateForTracks([matches[0].track]);
  }

  // N active tracks: a portfolio when scopes are disjoint; fail loud on overlap.
  const overlap = portfolio.overlap;
  if (overlap) {
    const [a, b] = overlap;
    const error = new Error(
      `Active tracks overlap on scope:\n  ${a.path}\n  ${b.path}\n`
      + "Give them disjoint component:/scope: or close one before continuing."
    );
    error.code = "OVERLAPPING_TRACKS";
    error.files = [a.path, b.path];
    throw error;
  }
  return stateForTracks(records.map((record) => record.track));
}

// ---------------------------------------------------------------------------
// Text rendering on JSON semantics (Plan-only counts, started-ordered
// portfolio, fail-loud overlap, trimmed trailing blanks).
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
    .map((item) => `  ${item[PLAN_ITEM_SOURCE].line}`);
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
  const waitingOn = nextBatch?.waiting_on || [];
  return [
    waitingOn.length > 0
      ? `Waiting: ${heading} (on ${waitingOn.join(", ")})`
      : (heading ? `Next: ${heading}` : "Next items:"),
    ...items.map((item) => `  ${item[PLAN_ITEM_SOURCE].line}`),
  ];
}

function nextSingleLines(perSprint) {
  const counts = countStates(perSprint.plan_items);
  const lines = [`=== Sprint: ${sprintSlug(perSprint.path)} ===`, ""];
  const goal = goalLines(perSprint.goal);
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
  const slug = sprintSlug(perSprint.path);
  const lines = [`${slug}: ${counts.done}/${counts.total} done${inFlight}`];
  const todo = perSprint.plan_items.find((item) => item.state === "todo");
  if (todo) {
    const waitingOn = perSprint.next_batch?.waiting_on || [];
    const label = waitingOn.length ? `Waiting on ${waitingOn.join(", ")}` : "Next";
    lines.push(`  ${label}: ${todo[PLAN_ITEM_SOURCE].line.replace(/^- \[ \] /, "")}`);
  }
  return lines;
}

function nextPortfolioLines(perSprints) {
  return [
    `=== ${perSprints.length} active tracks (portfolio) ===`,
    "",
    ...perSprints.flatMap((perSprint) => nextTrackLines(perSprint)),
    "",
    "Use 'node scripts/sprint-state.js --mode next --format text --track <slug>' for a single track.",
  ];
}

function statusCountLine(perSprint, { indent = "", unit = "" } = {}) {
  const counts = countStates(perSprint.plan_items);
  const inFlight = counts.in_flight > 0 ? ` — ${counts.in_flight} in-flight` : "";
  const slug = sprintSlug(perSprint.path);
  return `${indent}${slug}: ${counts.done}/${counts.total}${unit}`
    + ` (${percentDone(counts)}%)${inFlight}`;
}

function statusSingleLines(perSprint) {
  const counts = countStates(perSprint.plan_items);
  const lines = [statusCountLine(perSprint, { unit: " tasks" })];
  const inFlight = itemLines(perSprint.plan_items, "in_flight", 3);
  if (inFlight.length > 0) lines.push("", "In flight:", ...inFlight);
  const waitingOn = perSprint.next_batch?.waiting_on || [];
  if (waitingOn.length > 0) {
    // Only the blocked batch waits; later batches are not listed under it.
    const waiting = perSprint.next_batch.items.slice(0, 3)
      .map((item) => `  ${item[PLAN_ITEM_SOURCE].line}`);
    lines.push("", `Waiting on ${waitingOn.join(", ")}:`, ...waiting);
  } else {
    const todo = itemLines(perSprint.plan_items, "todo", 3);
    if (todo.length > 0) lines.push("", "Next up:", ...todo);
  }
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
    return { lines: [`No ${sprintsDir} directory. Create a sprint with sprint-init.js first.`], code: 1 };
  }
  const state = readSprintState(options);
  if (state.active_sprints.length === 0) {
    if (selector) return noTrackReport(sprintsDir, selector);
    return { lines: ["No active sprint found.", NO_SPRINT_HINT], code: 0 };
  }
  const lines = state.active_sprints.length === 1
    ? nextSingleLines(state.active_sprints[0])
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
  const body = state.active_sprints.length === 1
    ? statusSingleLines(state.active_sprints[0])
    : statusPortfolioLines(state.active_sprints);
  return { lines: [header, ...body], code: 0 };
}

// { lines, code } so the caller owns printing and the exit status.
function textReport(options) {
  const sprintsDir = path.join(options.backlogDir || DEFAULT_BACKLOG_DIR, "sprints");
  const selector = options.track || null;
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
  isActiveSprint,
  extractSectionLines,
  hasSection,
  parseProgressEntries,
  findUnparseablePlanLines,
  parsePlanItem,
  parsePlanItems,
  findNextBatch,
  parseSprintContent,
  readActiveTracks,
  readSprintState,
  textReport,
};
