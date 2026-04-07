#!/usr/bin/env node
/**
 * Sync monthly progress issue from backlog + GitHub state.
 *
 * Usage: node scripts/progress-sync.js
 *        node scripts/progress-sync.js --dry-run
 *        node scripts/progress-sync.js --json
 *        node scripts/progress-sync.js --month 2026-03
 *
 * Finds or creates the current month's Progress issue, then reconciles
 * the issue body from source data (tasks, PRs, sprint state).
 * The progress issue is a derived projection — never a source of truth.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { GH_EXEC_DEFAULTS } = require("./lib");

// --- Machine marker ---

const MARKER_PREFIX = "<!-- dev-backlog:progress-issue month=";
const MARKER_SUFFIX = " -->";

function makeMarker(month) {
  return `${MARKER_PREFIX}${month}${MARKER_SUFFIX}`;
}

function parseMarkerMonth(body) {
  if (!body) return null;
  const idx = body.indexOf(MARKER_PREFIX);
  if (idx === -1) return null;
  const start = idx + MARKER_PREFIX.length;
  const end = body.indexOf(MARKER_SUFFIX, start);
  if (end === -1) return null;
  return body.slice(start, end).trim();
}

// --- Month helpers ---

function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthTitle(month) {
  const [y, m] = month.split("-");
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `Progress: ${names[Number(m) - 1]} ${y}`;
}

function prevMonth(month) {
  const [y, m] = month.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

// --- Parse args ---

function parseArgs(args) {
  const options = { dryRun: false, json: false, month: null };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") { options.dryRun = true; continue; }
    if (arg === "--json") { options.json = true; continue; }
    if (arg === "--month") {
      const val = args[i + 1];
      if (!val || !/^\d{4}-\d{2}$/.test(val)) {
        return { ...options, error: "Invalid --month value. Expected YYYY-MM." };
      }
      options.month = val;
      i++;
      continue;
    }
    if (arg.startsWith("--month=")) {
      const val = arg.slice("--month=".length);
      if (!/^\d{4}-\d{2}$/.test(val)) {
        return { ...options, error: "Invalid --month value. Expected YYYY-MM." };
      }
      options.month = val;
      continue;
    }
  }
  return options;
}

// --- Local data readers ---

function readTaskFiles(tasksDir) {
  if (!fs.existsSync(tasksDir)) return [];
  return fs.readdirSync(tasksDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const content = fs.readFileSync(path.join(tasksDir, f), "utf-8");
      const fm = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fm) return { file: f, status: "unknown" };
      const statusMatch = fm[1].match(/^status:\s*(.+)$/m);
      return { file: f, status: statusMatch ? statusMatch[1].trim() : "unknown" };
    });
}

function readCompletedCount(completedDir) {
  if (!fs.existsSync(completedDir)) return 0;
  return fs.readdirSync(completedDir).filter((f) => f.endsWith(".md")).length;
}

function readActiveSprintSummary(sprintsDir) {
  if (!fs.existsSync(sprintsDir)) return null;
  const files = fs.readdirSync(sprintsDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("_")
  );
  for (const f of files) {
    const content = fs.readFileSync(path.join(sprintsDir, f), "utf-8");
    if (/^status:\s*active$/m.test(content)) {
      const done = (content.match(/^- \[x\] #/gm) || []).length;
      const inflight = (content.match(/^- \[~\] #/gm) || []).length;
      const todo = (content.match(/^- \[ \] #/gm) || []).length;
      const total = done + inflight + todo;
      return { file: f, done, inflight, todo, total };
    }
  }
  return null;
}

// --- Summary computation ---

function computeSummary({ tasks, completedCount, sprint, openPRs, mergedPRs }) {
  const merged = completedCount + mergedPRs.length;
  const inFlight = openPRs.length;

  // Stuck candidates: tasks still marked "In Progress" locally
  const stuckCandidates = tasks.filter((t) => t.status === "In Progress").length;

  return { merged, inFlight, stuckCandidates, sprint };
}

// --- Body rendering ---

function renderBody({ month, summary, prevIssueNumber }) {
  const marker = makeMarker(month);
  const lines = [marker, "", `# ${monthTitle(month)}`, ""];

  // Counts
  lines.push("## Summary", "");
  lines.push(`| Metric | Count |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Merged / completed | ${summary.merged} |`);
  lines.push(`| In-flight (open PRs) | ${summary.inFlight} |`);
  lines.push(`| Stuck candidates | ${summary.stuckCandidates} |`);
  lines.push("");

  // Sprint snapshot
  if (summary.sprint) {
    const s = summary.sprint;
    lines.push("## Active Sprint", "");
    lines.push(`**${s.file}** — ${s.done}/${s.total} done, ${s.inflight} in-flight, ${s.todo} remaining`);
    lines.push("");
  } else {
    lines.push("## Active Sprint", "");
    lines.push("_No active sprint._");
    lines.push("");
  }

  // Previous month link
  if (prevIssueNumber) {
    lines.push("## Previous", "");
    lines.push(`- #${prevIssueNumber}`);
    lines.push("");
  }

  return lines.join("\n");
}

// --- GitHub I/O ---

function searchProgressIssues(month, execFile) {
  const title = monthTitle(month);
  const out = execFile("gh", [
    "issue", "list", "--state", "all", "--search", `"${title}" in:title`,
    "--json", "number,title,body", "--limit", "50",
  ], GH_EXEC_DEFAULTS);
  return JSON.parse(out);
}

function findMonthIssue(month, execFile) {
  const issues = searchProgressIssues(month, execFile);
  const marker = makeMarker(month);
  // Trust marker first
  const markerMatch = issues.find((i) => i.body && i.body.includes(marker));
  if (markerMatch) return markerMatch;
  // Fallback: exact title match
  const title = monthTitle(month);
  return issues.find((i) => i.title === title) || null;
}

function createIssue(title, body, execFile) {
  const out = execFile("gh", [
    "issue", "create", "--title", title, "--body", body,
    "--json", "number,title,body",
  ], GH_EXEC_DEFAULTS);
  return JSON.parse(out);
}

function updateIssueBody(number, body, execFile) {
  execFile("gh", [
    "issue", "edit", String(number), "--body", body,
  ], GH_EXEC_DEFAULTS);
}

function fetchOpenPRs(execFile) {
  try {
    const out = execFile("gh", [
      "pr", "list", "--state", "open", "--json", "number,title",
      "--limit", "100",
    ], GH_EXEC_DEFAULTS);
    return JSON.parse(out);
  } catch {
    return [];
  }
}

function fetchMergedPRsThisMonth(month, execFile) {
  const [y, m] = month.split("-");
  const start = `${y}-${m}-01`;
  // Approximate end of month
  const nextM = Number(m) === 12 ? 1 : Number(m) + 1;
  const nextY = Number(m) === 12 ? Number(y) + 1 : Number(y);
  const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  try {
    const out = execFile("gh", [
      "pr", "list", "--state", "merged",
      "--search", `merged:${start}..${end}`,
      "--json", "number,title",
      "--limit", "200",
    ], GH_EXEC_DEFAULTS);
    return JSON.parse(out);
  } catch {
    return [];
  }
}

// --- Core sync logic ---

function sync({
  month,
  dryRun,
  backlogDir = "backlog",
  execFile = execFileSync,
  readFs = { readTaskFiles, readCompletedCount, readActiveSprintSummary },
}) {
  const tasksDir = path.join(backlogDir, "tasks");
  const completedDir = path.join(backlogDir, "completed");
  const sprintsDir = path.join(backlogDir, "sprints");

  // Gather source data
  const tasks = readFs.readTaskFiles(tasksDir);
  const completedCount = readFs.readCompletedCount(completedDir);
  const sprint = readFs.readActiveSprintSummary(sprintsDir);
  const openPRs = fetchOpenPRs(execFile);
  const mergedPRs = fetchMergedPRsThisMonth(month, execFile);

  const summary = computeSummary({ tasks, completedCount, sprint, openPRs, mergedPRs });

  // Find or create current month issue
  const existing = findMonthIssue(month, execFile);

  // Find previous month issue for linking
  const prev = prevMonth(month);
  const prevIssue = findMonthIssue(prev, execFile);
  const prevIssueNumber = prevIssue ? prevIssue.number : null;

  const body = renderBody({ month, summary, prevIssueNumber });
  const title = monthTitle(month);

  const result = {
    action: "progress-sync",
    month,
    dryRun,
    summary,
    prevIssueNumber,
  };

  if (existing) {
    result.issueNumber = existing.number;
    result.created = false;
    if (!dryRun) {
      updateIssueBody(existing.number, body, execFile);
    }
    result.updated = !dryRun;
  } else {
    result.created = !dryRun;
    result.updated = false;
    if (!dryRun) {
      const created = createIssue(title, body, execFile);
      result.issueNumber = created.number;
    } else {
      result.issueNumber = null;
    }
  }

  result.body = body;
  return result;
}

// --- Output ---

function printResult(result) {
  const label = result.dryRun ? "[dry-run] " : "";

  if (result.created) {
    console.log(`${label}Created progress issue #${result.issueNumber}: ${monthTitle(result.month)}`);
  } else if (result.updated) {
    console.log(`${label}Updated progress issue #${result.issueNumber}: ${monthTitle(result.month)}`);
  } else if (result.dryRun) {
    const verb = result.issueNumber ? "update" : "create";
    const ref = result.issueNumber ? ` #${result.issueNumber}` : "";
    console.log(`${label}Would ${verb}${ref}: ${monthTitle(result.month)}`);
  }

  const s = result.summary;
  console.log(`  merged/completed: ${s.merged}, in-flight: ${s.inFlight}, stuck candidates: ${s.stuckCandidates}`);

  if (s.sprint) {
    console.log(`  sprint: ${s.sprint.file} (${s.sprint.done}/${s.sprint.total} done)`);
  } else {
    console.log("  sprint: (none)");
  }

  if (result.prevIssueNumber) {
    console.log(`  previous: #${result.prevIssueNumber}`);
  }

  console.log("Done.");
}

// --- CLI ---

function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  if (options.error) {
    console.error(options.error);
    process.exit(1);
  }

  const month = options.month || monthKey(new Date());

  try {
    const result = sync({ month, dryRun: options.dryRun });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printResult(result);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  makeMarker,
  parseMarkerMonth,
  monthKey,
  monthTitle,
  prevMonth,
  parseArgs,
  readTaskFiles,
  readCompletedCount,
  readActiveSprintSummary,
  computeSummary,
  renderBody,
  findMonthIssue,
  sync,
  printResult,
};
