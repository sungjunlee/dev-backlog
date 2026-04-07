#!/usr/bin/env node
/**
 * Sync monthly progress issue from backlog + GitHub state.
 *
 * Usage: node scripts/progress-sync.js
 *        node scripts/progress-sync.js --dry-run
 *        node scripts/progress-sync.js --json
 *        node scripts/progress-sync.js --month 2026-03
 *        node scripts/progress-sync.js --relay-manifest ~/.relay/runs/<repo>/<run>.md
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

function relayMergeEntryKey(runId) {
  return `run/${runId}/merge`;
}

function relayStuckEntryKey(runId) {
  return `run/${runId}/stuck`;
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
  const options = { dryRun: false, json: false, month: null, relayManifest: null };

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

function parseTaskIssueNumber(taskFile) {
  const match = String(taskFile || "").match(/^[A-Za-z]+-(\d+)\b/);
  return match ? Number(match[1]) : null;
}

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

function normalizeRelayField(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "unknown" || trimmed === "null") return null;
    return trimmed;
  }
  return value;
}

function parseFrontmatterScalar(value) {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return JSON.parse(value);
  }
  return value;
}

function parseFrontmatter(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") {
    return {};
  }

  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex === -1) {
    throw new Error("Invalid relay manifest: missing closing frontmatter marker");
  }

  const frontmatterLines = lines.slice(1, closingIndex);

  function parseBlock(startIndex, indent) {
    const data = {};
    let index = startIndex;

    while (index < frontmatterLines.length) {
      const raw = frontmatterLines[index];
      if (!raw.trim()) {
        index++;
        continue;
      }

      const currentIndent = raw.match(/^ */)[0].length;
      if (currentIndent < indent) break;
      if (currentIndent > indent) {
        throw new Error(`Invalid relay manifest indentation on line ${index + 2}`);
      }

      const trimmed = raw.trim();
      const separator = trimmed.indexOf(":");
      if (separator === -1) {
        throw new Error(`Invalid relay manifest entry on line ${index + 2}`);
      }

      const key = trimmed.slice(0, separator).trim();
      const rest = trimmed.slice(separator + 1).trim();

      if (!rest) {
        const nested = parseBlock(index + 1, indent + 2);
        data[key] = nested.data;
        index = nested.index;
        continue;
      }

      data[key] = parseFrontmatterScalar(rest);
      index++;
    }

    return { data, index };
  }

  return parseBlock(0, 0).data;
}

function relayEventsPath(relayManifestPath, runId) {
  return path.join(path.dirname(relayManifestPath), runId, "events.jsonl");
}

function readRelayManifestMetadata(relayManifestPath) {
  const resolved = path.resolve(relayManifestPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Relay manifest not found: ${resolved}`);
  }

  const text = fs.readFileSync(resolved, "utf-8");
  const data = parseFrontmatter(text);
  const runId = normalizeRelayField(data.run_id) || path.basename(resolved, path.extname(resolved));

  return {
    manifestPath: resolved,
    runId,
    state: normalizeRelayField(data.state),
    nextAction: normalizeRelayField(data.next_action),
    issueNumber: Number.isFinite(data.issue?.number) ? data.issue.number : null,
    prNumber: Number.isFinite(data.git?.pr_number) ? data.git.pr_number : null,
    executor: normalizeRelayField(data.roles?.executor),
    reviewer: normalizeRelayField(data.roles?.reviewer),
    actor: normalizeRelayField(data.roles?.actor) || normalizeRelayField(data.roles?.orchestrator),
    rounds: Number.isFinite(data.review?.rounds) ? data.review.rounds : null,
  };
}

function readRelayGrade(eventsPath) {
  if (!fs.existsSync(eventsPath)) return null;

  let grade = null;
  const lines = fs.readFileSync(eventsPath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const record = JSON.parse(line);
    if (record.event === "rubric_quality" && typeof record.grade === "string" && record.grade.trim()) {
      grade = record.grade.trim();
    }
  }

  return grade;
}

function loadRelayMetadata(relayManifestPath) {
  if (!relayManifestPath) return null;

  const metadata = readRelayManifestMetadata(relayManifestPath);
  return {
    ...metadata,
    eventsPath: relayEventsPath(metadata.manifestPath, metadata.runId),
    grade: readRelayGrade(relayEventsPath(metadata.manifestPath, metadata.runId)),
  };
}

function relayDetailLine(relay, { includeState = false } = {}) {
  if (!relay?.runId) return null;

  const parts = [`run \`${relay.runId}\``];
  if (relay.grade) parts.push(`grade ${relay.grade}`);
  if (typeof relay.rounds === "number") parts.push(`rounds ${relay.rounds}`);
  if (relay.executor) parts.push(`executor ${relay.executor}`);
  if (relay.reviewer) parts.push(`reviewer ${relay.reviewer}`);
  if (relay.actor) parts.push(`actor ${relay.actor}`);
  if (includeState && relay.state) parts.push(`state ${relay.state}`);
  if (includeState && relay.nextAction) parts.push(`next ${relay.nextAction}`);

  return parts.length ? `**Relay:** ${parts.join(" · ")}` : null;
}

function renderMergeComment(month, pr, relay = null) {
  const entryId = relay?.runId ? relayMergeEntryKey(relay.runId) : mergeEntryKey(month, pr.number);
  const marker = makeCommentMarker(entryId);
  const lines = [marker, `**Merged:** #${pr.number} — ${pr.title}`];
  const relayLine = relayDetailLine(relay);
  if (relayLine) {
    lines.push("", relayLine);
  }
  return lines.join("\n");
}

function renderStuckComment(month, task, relay = null) {
  const entryId = relay?.runId ? relayStuckEntryKey(relay.runId) : stuckEntryKey(month, task.file);
  const marker = makeCommentMarker(entryId);
  const lines = [marker, `**Stuck candidate:** ${task.file} (status: ${task.status})`];
  const relayLine = relayDetailLine(relay, { includeState: true });
  if (relayLine) {
    lines.push("", relayLine);
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

function parsePaginatedApiArray(output) {
  const text = String(output || "").trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {}

  try {
    const combined = `[${text.replace(/\]\s*\[/g, "],[")}]`;
    const parsed = JSON.parse(combined);
    return parsed.flatMap((page) => Array.isArray(page) ? page : [page]);
  } catch {
    return [];
  }
}

function fetchIssueComments(issueNumber, execFile) {
  try {
    const out = execFile("gh", [
      "api", `repos/{owner}/{repo}/issues/${issueNumber}/comments`,
      "--paginate",
    ], GH_EXEC_DEFAULTS);
    return parsePaginatedApiArray(out);
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

function buildDesiredCommentEntries({ mergedPRs, stuckTasks, month, relayMetadata }) {
  const desired = [];

  for (const pr of mergedPRs) {
    const relay = relayMetadata?.runId && relayMetadata.prNumber === pr.number ? relayMetadata : null;
    desired.push({
      entryId: relay ? relayMergeEntryKey(relay.runId) : mergeEntryKey(month, pr.number),
      aliasIds: relay ? [mergeEntryKey(month, pr.number)] : [],
      body: renderMergeComment(month, pr, relay),
    });
  }

  for (const task of stuckTasks) {
    const taskIssueNumber = task.issueNumber ?? parseTaskIssueNumber(task.file);
    const relay = relayMetadata?.runId && relayMetadata.issueNumber === taskIssueNumber ? relayMetadata : null;
    desired.push({
      entryId: relay ? relayStuckEntryKey(relay.runId) : stuckEntryKey(month, task.file),
      aliasIds: relay ? [stuckEntryKey(month, task.file)] : [],
      body: renderStuckComment(month, task, relay),
    });
  }

  return desired;
}

function matchingManagedComments(byEntryId, entry) {
  const unique = new Map();
  const entryIds = [entry.entryId, ...(entry.aliasIds || [])];

  for (const entryId of entryIds) {
    const matches = byEntryId.get(entryId) || [];
    for (const match of matches) {
      unique.set(match.id, match);
    }
  }

  return Array.from(unique.values());
}

function selectPrimaryManagedComment(existing, canonicalEntryId) {
  return existing.find((comment) => comment.entryId === canonicalEntryId) || existing[0];
}

function reconcileComments({
  issueNumber,
  mergedPRs,
  stuckTasks,
  month,
  relayMetadata = null,
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

  const desired = buildDesiredCommentEntries({ mergedPRs, stuckTasks, month, relayMetadata });

  const actions = { created: 0, updated: 0, skipped: 0, repaired: 0 };

  for (const entry of desired) {
    const existing = matchingManagedComments(byEntryId, entry);

    if (existing.length === 0) {
      // Create new comment
      if (!dryRun) createIssueComment(issueNumber, entry.body, execFile);
      actions.created++;
    } else if (existing.length === 1) {
      // Single existing — update if body differs, skip if identical
      if (existing[0].body === entry.body && existing[0].entryId === entry.entryId) {
        actions.skipped++;
      } else {
        if (!dryRun) updateIssueComment(existing[0].id, entry.body, execFile);
        actions.updated++;
      }
    } else {
      // Duplicate repair: keep the first, update it, delete the rest
      const primary = selectPrimaryManagedComment(existing, entry.entryId);
      const duplicates = existing.filter((comment) => comment.id !== primary.id);
      if (!dryRun) {
        updateIssueComment(primary.id, entry.body, execFile);
        for (const duplicate of duplicates) {
          deleteIssueComment(duplicate.id, execFile);
        }
      }
      actions.repaired++;
    }

    // Remove processed entry from index so we don't revisit
    byEntryId.delete(entry.entryId);
    for (const aliasId of entry.aliasIds || []) {
      byEntryId.delete(aliasId);
    }
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
  relayManifestPath = null,
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
  const relayMetadata = loadRelayMetadata(relayManifestPath);

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
