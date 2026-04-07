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

// --- Machine marker (body) ---

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

// --- Machine marker (comment) ---

const COMMENT_MARKER_PREFIX = "<!-- dev-backlog:progress-comment id=";
const COMMENT_MARKER_SUFFIX = " -->";

function makeCommentMarker(entryId) {
  return `${COMMENT_MARKER_PREFIX}${entryId}${COMMENT_MARKER_SUFFIX}`;
}

function parseCommentEntryId(body) {
  if (!body) return null;
  const idx = body.indexOf(COMMENT_MARKER_PREFIX);
  if (idx === -1) return null;
  const start = idx + COMMENT_MARKER_PREFIX.length;
  const end = body.indexOf(COMMENT_MARKER_SUFFIX, start);
  if (end === -1) return null;
  return body.slice(start, end).trim() || null;
}

// --- Entry key derivation ---

function mergeEntryKey(month, prNumber) {
  return `${month}/merge/pr-${prNumber}`;
}

function stuckEntryKey(month, taskFile) {
  return `${month}/stuck/${taskFile}`;
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

function computeSummary({ tasks, sprint, openPRs, mergedPRs }) {
  const merged = mergedPRs.length;
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

// --- Comment rendering ---

function renderMergeComment(month, pr) {
  const marker = makeCommentMarker(mergeEntryKey(month, pr.number));
  return `${marker}\n**Merged:** #${pr.number} — ${pr.title}`;
}

function renderStuckComment(month, task) {
  const marker = makeCommentMarker(stuckEntryKey(month, task.file));
  return `${marker}\n**Stuck candidate:** ${task.file} (status: ${task.status})`;
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
  ], GH_EXEC_DEFAULTS);
  // gh issue create prints the issue URL, e.g. https://github.com/owner/repo/issues/123
  const match = out.trim().match(/\/issues\/(\d+)\s*$/);
  if (!match) {
    throw new Error(`Failed to parse issue number from gh output: ${out.trim()}`);
  }
  return { number: Number(match[1]) };
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
      "--search", `merged:>=${start} merged:<${end}`,
      "--json", "number,title",
      "--limit", "200",
    ], GH_EXEC_DEFAULTS);
    return JSON.parse(out);
  } catch {
    return [];
  }
}

// --- Comment I/O ---

function fetchIssueComments(issueNumber, execFile) {
  try {
    const out = execFile("gh", [
      "api", `repos/{owner}/{repo}/issues/${issueNumber}/comments`,
      "--paginate",
    ], GH_EXEC_DEFAULTS);
    // gh api --paginate concatenates JSON arrays; flatten if needed
    const parsed = JSON.parse(out);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createIssueComment(issueNumber, body, execFile) {
  execFile("gh", [
    "api", `repos/{owner}/{repo}/issues/${issueNumber}/comments`,
    "--method", "POST", "--field", `body=${body}`,
  ], GH_EXEC_DEFAULTS);
}

function updateIssueComment(commentId, body, execFile) {
  execFile("gh", [
    "api", `repos/{owner}/{repo}/issues/comments/${commentId}`,
    "--method", "PATCH", "--field", `body=${body}`,
  ], GH_EXEC_DEFAULTS);
}

function deleteIssueComment(commentId, execFile) {
  execFile("gh", [
    "api", `repos/{owner}/{repo}/issues/comments/${commentId}`,
    "--method", "DELETE",
  ], GH_EXEC_DEFAULTS);
}

// --- Comment reconciliation ---

function parseManagedComments(comments) {
  const managed = [];
  for (const c of comments) {
    const entryId = parseCommentEntryId(c.body);
    if (entryId) {
      managed.push({ id: c.id, entryId, body: c.body });
    }
  }
  return managed;
}

function reconcileComments({
  issueNumber,
  mergedPRs,
  stuckTasks,
  month,
  dryRun,
  execFile,
  fetchComments = fetchIssueComments,
}) {
  const allComments = fetchComments(issueNumber, execFile);
  const managed = parseManagedComments(allComments);

  // Build index: entryId → [managed comments]
  const byEntryId = new Map();
  for (const mc of managed) {
    if (!byEntryId.has(mc.entryId)) byEntryId.set(mc.entryId, []);
    byEntryId.get(mc.entryId).push(mc);
  }

  // Build desired entries: { entryId, body }
  const desired = [];
  for (const pr of mergedPRs) {
    desired.push({
      entryId: mergeEntryKey(month, pr.number),
      body: renderMergeComment(month, pr),
    });
  }
  for (const task of stuckTasks) {
    desired.push({
      entryId: stuckEntryKey(month, task.file),
      body: renderStuckComment(month, task),
    });
  }

  const actions = { created: 0, updated: 0, skipped: 0, repaired: 0 };

  for (const entry of desired) {
    const existing = byEntryId.get(entry.entryId) || [];

    if (existing.length === 0) {
      // Create new comment
      if (!dryRun) createIssueComment(issueNumber, entry.body, execFile);
      actions.created++;
    } else if (existing.length === 1) {
      // Single existing — update if body differs, skip if identical
      if (existing[0].body === entry.body) {
        actions.skipped++;
      } else {
        if (!dryRun) updateIssueComment(existing[0].id, entry.body, execFile);
        actions.updated++;
      }
    } else {
      // Duplicate repair: keep the first, update it, delete the rest
      if (!dryRun) {
        updateIssueComment(existing[0].id, entry.body, execFile);
        for (let i = 1; i < existing.length; i++) {
          deleteIssueComment(existing[i].id, execFile);
        }
      }
      actions.repaired++;
    }

    // Remove processed entry from index so we don't revisit
    byEntryId.delete(entry.entryId);
  }

  // Remaining managed comments with entry ids not in desired set are left as-is
  // (they may be from a previous month or an entry type we no longer emit)

  return actions;
}

// --- Core sync logic ---

function sync({
  month,
  dryRun,
  backlogDir = "backlog",
  execFile = execFileSync,
  readFs = { readTaskFiles, readCompletedCount, readActiveSprintSummary },
  fetchComments = fetchIssueComments,
}) {
  const tasksDir = path.join(backlogDir, "tasks");
  const completedDir = path.join(backlogDir, "completed");
  const sprintsDir = path.join(backlogDir, "sprints");

  // Gather source data
  const tasks = readFs.readTaskFiles(tasksDir);
  const sprint = readFs.readActiveSprintSummary(sprintsDir);
  const openPRs = fetchOpenPRs(execFile);
  const mergedPRs = fetchMergedPRsThisMonth(month, execFile);

  const summary = computeSummary({ tasks, sprint, openPRs, mergedPRs });

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

  // Reconcile managed comments on the progress issue
  if (result.issueNumber) {
    const stuckTasks = tasks.filter((t) => t.status === "In Progress");
    result.comments = reconcileComments({
      issueNumber: result.issueNumber,
      mergedPRs,
      stuckTasks,
      month,
      dryRun,
      execFile,
      fetchComments,
    });
  } else {
    result.comments = { created: 0, updated: 0, skipped: 0, repaired: 0 };
  }

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

  if (result.comments) {
    const c = result.comments;
    console.log(`  comments: ${c.created} created, ${c.updated} updated, ${c.skipped} skipped, ${c.repaired} repaired`);
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
  makeCommentMarker,
  parseCommentEntryId,
  mergeEntryKey,
  stuckEntryKey,
  renderMergeComment,
  renderStuckComment,
  parseManagedComments,
  reconcileComments,
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
  fetchMergedPRsThisMonth,
  sync,
  printResult,
};
