const { GH_EXEC_DEFAULTS } = require("./lib");
const {
  makeMarker,
  monthTitle,
  parseManagedComments,
  buildDesiredCommentEntries,
} = require("./progress-sync-render");

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
  const markerMatch = issues.find((issue) => issue.body && issue.body.includes(marker));
  if (markerMatch) return markerMatch;
  const title = monthTitle(month);
  return issues.find((issue) => issue.title === title) || null;
}

function createIssue(title, body, execFile) {
  const out = execFile("gh", [
    "issue", "create", "--title", title, "--body", body,
  ], GH_EXEC_DEFAULTS);
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

function closeIssue(number, execFile) {
  execFile("gh", [
    "api", `repos/{owner}/{repo}/issues/${number}`,
    "--method", "PATCH",
    "--field", "state=closed",
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
  const nextM = Number(m) === 12 ? 1 : Number(m) + 1;
  const nextY = Number(m) === 12 ? Number(y) + 1 : Number(y);
  const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
  try {
    const out = execFile("gh", [
      "pr", "list", "--state", "merged",
      "--search", `merged:>=${start} merged:<${end}`,
      "--json", "number,title,url,mergedAt,closingIssuesReferences",
      "--limit", "200",
    ], GH_EXEC_DEFAULTS);
    return JSON.parse(out);
  } catch {
    return [];
  }
}

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

  const byEntryId = new Map();
  for (const comment of managed) {
    if (!byEntryId.has(comment.entryId)) byEntryId.set(comment.entryId, []);
    byEntryId.get(comment.entryId).push(comment);
  }

  const desired = buildDesiredCommentEntries({ mergedPRs, stuckTasks, month, relayMetadata });
  const actions = { created: 0, updated: 0, skipped: 0, repaired: 0 };

  for (const entry of desired) {
    const existing = matchingManagedComments(byEntryId, entry);

    if (existing.length === 0) {
      if (!dryRun) createIssueComment(issueNumber, entry.body, execFile);
      actions.created++;
    } else if (existing.length === 1) {
      if (existing[0].body === entry.body && existing[0].entryId === entry.entryId) {
        actions.skipped++;
      } else {
        if (!dryRun) updateIssueComment(existing[0].id, entry.body, execFile);
        actions.updated++;
      }
    } else {
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

    byEntryId.delete(entry.entryId);
    for (const aliasId of entry.aliasIds || []) {
      byEntryId.delete(aliasId);
    }
  }

  return actions;
}

module.exports = {
  findMonthIssue,
  createIssue,
  updateIssueBody,
  closeIssue,
  fetchOpenPRs,
  fetchMergedPRsThisMonth,
  fetchIssueComments,
  reconcileComments,
};
