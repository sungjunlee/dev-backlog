#!/usr/bin/env node
/**
 * Emit actor-readable state from the active sprint file.
 *
 * Human status/next output stays in the shell scripts; their --json paths
 * delegate here so markdown parsing for structured reads has one owner.
 */

const fs = require("fs");
const path = require("path");
const { parseSimpleYaml } = require("./lib.js");

const SCHEMA_VERSION = 1;
const DEFAULT_BACKLOG_DIR = "backlog";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const CHECKBOX_RE = /^- \[( |~|x)\] #(\d+)(?:\s+(.*))?$/;
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
  return "Usage: sprint-state.js [--mode status|next] [backlog-dir]";
}

function parseArgs(args) {
  const options = {
    mode: "status",
    backlogDir: DEFAULT_BACKLOG_DIR,
  };
  let backlogDirSet = false;

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

  return options;
}

function emptyState() {
  return {
    schema_version: SCHEMA_VERSION,
    active_sprint: null,
    plan_items: [],
    next_batch: null,
    latest_progress: [],
    in_flight: [],
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
  const checkbox = line.match(CHECKBOX_RE);
  if (!checkbox) return null;

  const checkboxState = checkbox[1];
  const issueNumber = Number.parseInt(checkbox[2], 10);
  let title = (checkbox[3] || "").trim();

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
    issue_number: issueNumber,
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

function computeAge(issueNumber, progressEntries, startedDate, today) {
  const issueRe = new RegExp(`#${issueNumber}(?!\\d)`);
  const progressDates = progressEntries
    .filter((entry) => entry.date && issueRe.test(entry.line))
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
}) {
  const frontmatter = parseFrontmatter(content);
  const goal = extractSectionLines(content, "Goal").join("\n").trim();
  const planItems = parsePlanItems(extractSectionLines(content, "Plan"));
  const progressEntries = parseProgressEntries(extractSectionLines(content, "Progress"));
  const nextBatch = findNextBatch(planItems);
  const inFlight = planItems
    .filter((item) => item.state === "in_flight")
    .map((item) => ({
      ...item,
      ...computeAge(item.issue_number, progressEntries, frontmatter.started, today),
    }));

  return {
    schema_version: SCHEMA_VERSION,
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

function readSprintState({
  backlogDir = DEFAULT_BACKLOG_DIR,
  today = new Date(),
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
  if (activeFiles.length > 1) {
    const error = new Error(
      `Multiple active sprint files found:\n${activeFiles.map((file) => `  ${file}`).join("\n")}`
    );
    error.code = "MULTIPLE_ACTIVE_SPRINTS";
    error.files = activeFiles;
    throw error;
  }

  const sprintPath = activeFiles[0];
  return parseSprintContent({
    sprintPath,
    content: readFileSync(sprintPath, "utf-8"),
    today,
  });
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
    const state = readSprintState({ backlogDir: parsed.backlogDir });
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
