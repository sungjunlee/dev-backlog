#!/usr/bin/env node
/**
 * Sync monthly progress issue from backlog + GitHub state.
 *
 * Usage: node scripts/progress-sync.js
 *        node scripts/progress-sync.js --dry-run
 *        node scripts/progress-sync.js --json
 *        node scripts/progress-sync.js --month 2026-03
 *        node scripts/progress-sync.js --month 2026-03 --finalize
 *        node scripts/progress-sync.js --relay-manifest ~/.relay/runs/<repo>/<run>.md
 *
 * Finds or creates the current month's Progress issue, then reconciles
 * the issue body from source data (tasks, PRs, sprint state).
 * The progress issue is a derived projection — never a source of truth.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  makeMarker,
  parseMarkerMonth,
  makeCommentMarker,
  parseCommentEntryId,
  mergeEntryKey,
  stuckEntryKey,
  relayMergeEntryKey,
  relayStuckEntryKey,
  parseTaskIssueNumber,
  monthTitle,
  renderBody,
  renderMergeComment,
  renderStuckComment,
  parseManagedComments,
  buildDesiredCommentEntries,
} = require("./progress-sync-render");
const {
  readRelayManifestMetadata,
  readRelayGrade,
  loadRelayMetadata,
} = require("./progress-sync-relay");
const {
  findMonthIssue,
  createIssue,
  updateIssueBody,
  closeIssue,
  fetchOpenPRs,
  fetchMergedPRsThisMonth,
  fetchIssueComments,
  reconcileComments,
} = require("./progress-sync-github");

function monthKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function prevMonth(month) {
  const [y, m] = month.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(month) {
  const [y, m] = month.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseFinalizedDate(body) {
  if (!body) return null;
  const match = body.match(/^- Finalized on: (\d{4}-\d{2}-\d{2})$/m);
  return match ? match[1] : null;
}

// --- Parse args ---

function parseArgs(args) {
  const options = { dryRun: false, json: false, month: null, relayManifest: null, finalize: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") { options.dryRun = true; continue; }
    if (arg === "--json") { options.json = true; continue; }
    if (arg === "--finalize") { options.finalize = true; continue; }
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
    if (arg === "--relay-manifest") {
      const val = args[i + 1];
      if (!val) {
        return { ...options, error: "Missing --relay-manifest value." };
      }
      options.relayManifest = val;
      i++;
      continue;
    }
    if (arg.startsWith("--relay-manifest=")) {
      const val = arg.slice("--relay-manifest=".length);
      if (!val) {
        return { ...options, error: "Missing --relay-manifest value." };
      }
      options.relayManifest = val;
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
      if (!fm) return { file: f, issueNumber: parseTaskIssueNumber(f), status: "unknown" };
      const statusMatch = fm[1].match(/^status:\s*(.+)$/m);
      return {
        file: f,
        issueNumber: parseTaskIssueNumber(f),
        status: statusMatch ? statusMatch[1].trim() : "unknown",
      };
    });
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

// --- Core sync logic ---

function sync({
  month,
  dryRun,
  finalize = false,
  backlogDir = "backlog",
  relayManifestPath = null,
  now = new Date(),
  execFile = execFileSync,
  readFs = { readTaskFiles, readActiveSprintSummary },
  fetchComments = fetchIssueComments,
}) {
  const tasksDir = path.join(backlogDir, "tasks");
  const sprintsDir = path.join(backlogDir, "sprints");

  // Gather source data
  const tasks = readFs.readTaskFiles(tasksDir);
  const sprint = readFs.readActiveSprintSummary(sprintsDir);
  const openPRs = fetchOpenPRs(execFile);
  const mergedPRs = fetchMergedPRsThisMonth(month, execFile);
  const relayMetadata = loadRelayMetadata(relayManifestPath);

  const summary = computeSummary({ tasks, sprint, openPRs, mergedPRs });

  // Find or create current month issue
  const existing = findMonthIssue(month, execFile);

  // Find previous month issue for linking
  const prev = prevMonth(month);
  const prevIssue = findMonthIssue(prev, execFile);
  const prevIssueNumber = prevIssue ? prevIssue.number : null;
  const next = nextMonth(month);
  const nextIssue = findMonthIssue(next, execFile);
  const nextIssueNumber = nextIssue ? nextIssue.number : null;

  const finalizedAt = finalize
    ? parseFinalizedDate(existing?.body) || formatDate(now)
    : null;
  const body = renderBody({
    month,
    summary: { ...summary, finalizedAt },
    prevIssueNumber,
    nextIssueNumber,
  });
  const title = monthTitle(month);

  const result = {
    action: "progress-sync",
    month,
    dryRun,
    finalize,
    summary,
    prevIssueNumber,
    nextIssueNumber,
    finalizedAt,
    relay: relayMetadata ? {
      runId: relayMetadata.runId,
      issueNumber: relayMetadata.issueNumber,
      prNumber: relayMetadata.prNumber,
      grade: relayMetadata.grade,
      rounds: relayMetadata.rounds,
    } : null,
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
      relayMetadata,
      dryRun,
      execFile,
      fetchComments,
    });
  } else {
    result.comments = { created: 0, updated: 0, skipped: 0, repaired: 0 };
  }

  if (finalize && result.issueNumber) {
    if (!dryRun) {
      closeIssue(result.issueNumber, execFile);
    }
    result.closed = !dryRun;
  } else {
    result.closed = false;
  }

  return result;
}

// --- Output ---

function printResult(result) {
  const label = result.dryRun ? "[dry-run] " : "";

  if (result.finalize) {
    if (result.dryRun) {
      if (result.issueNumber) {
        console.log(`${label}Would finalize and close #${result.issueNumber}: ${monthTitle(result.month)}`);
      } else {
        console.log(`${label}Would create, finalize, and close: ${monthTitle(result.month)}`);
      }
    } else {
      console.log(`Finalized and closed progress issue #${result.issueNumber}: ${monthTitle(result.month)}`);
    }
  } else if (result.created) {
    console.log(`${label}Created progress issue #${result.issueNumber}: ${monthTitle(result.month)}`);
  } else if (result.updated) {
    console.log(`${label}Updated progress issue #${result.issueNumber}: ${monthTitle(result.month)}`);
  } else if (result.dryRun) {
    const verb = result.issueNumber ? "update" : "create";
    const ref = result.issueNumber ? ` #${result.issueNumber}` : "";
    console.log(`${label}Would ${verb}${ref}: ${monthTitle(result.month)}`);
  }

  const s = result.summary;
  console.log(`  merged PRs (month): ${s.merged}, in-flight: ${s.inFlight}, stuck candidates: ${s.stuckCandidates}`);

  if (s.sprint) {
    console.log(`  sprint: ${s.sprint.file} (${s.sprint.done}/${s.sprint.total} done)`);
  } else {
    console.log("  sprint: (none)");
  }

  if (result.prevIssueNumber) {
    console.log(`  previous: #${result.prevIssueNumber}`);
  }

  if (result.nextIssueNumber) {
    console.log(`  next: #${result.nextIssueNumber}`);
  }

  if (result.finalizedAt) {
    console.log(`  finalized: ${result.finalizedAt}`);
  }

  if (result.comments) {
    const c = result.comments;
    console.log(`  comments: ${c.created} created, ${c.updated} updated, ${c.skipped} skipped, ${c.repaired} repaired`);
  }

  if (result.relay) {
    const details = [`run ${result.relay.runId}`];
    if (result.relay.grade) details.push(`grade ${result.relay.grade}`);
    if (typeof result.relay.rounds === "number") details.push(`rounds ${result.relay.rounds}`);
    console.log(`  relay: ${details.join(", ")}`);
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
    const result = sync({
      month,
      dryRun: options.dryRun,
      finalize: options.finalize,
      relayManifestPath: options.relayManifest,
    });

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
  relayMergeEntryKey,
  relayStuckEntryKey,
  renderMergeComment,
  renderStuckComment,
  parseManagedComments,
  parseTaskIssueNumber,
  readRelayManifestMetadata,
  readRelayGrade,
  loadRelayMetadata,
  buildDesiredCommentEntries,
  reconcileComments,
  monthKey,
  monthTitle,
  prevMonth,
  nextMonth,
  formatDate,
  parseFinalizedDate,
  parseArgs,
  readTaskFiles,
  readActiveSprintSummary,
  computeSummary,
  renderBody,
  findMonthIssue,
  fetchMergedPRsThisMonth,
  closeIssue,
  sync,
  printResult,
};
