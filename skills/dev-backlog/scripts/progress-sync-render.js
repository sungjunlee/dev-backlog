const MARKER_PREFIX = "<!-- dev-backlog:progress-issue month=";
const MARKER_SUFFIX = " -->";
const COMMENT_MARKER_PREFIX = "<!-- dev-backlog:progress-comment id=";
const COMMENT_MARKER_SUFFIX = " -->";

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

function parseTaskIssueNumber(taskFile) {
  const match = String(taskFile || "").match(/^[A-Za-z]+-(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function monthTitle(month) {
  const [y, m] = month.split("-");
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `Progress: ${names[Number(m) - 1]} ${y}`;
}

function renderBody({ month, summary, prevIssueNumber, nextIssueNumber }) {
  const marker = makeMarker(month);
  const lines = [marker, "", `# ${monthTitle(month)}`, ""];

  lines.push("## Summary", "");
  lines.push(`| Metric | Count |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Merged PRs (month) | ${summary.merged} |`);
  lines.push(`| In-flight (open PRs) | ${summary.inFlight} |`);
  lines.push(`| Stuck candidates | ${summary.stuckCandidates} |`);
  lines.push("");

  if (summary.finalizedAt) {
    lines.push("## Month End", "");
    lines.push(`- Finalized on: ${summary.finalizedAt}`);
    lines.push("- State: closed");
    lines.push("");
  }

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

  if (prevIssueNumber) {
    lines.push("## Previous", "");
    lines.push(`- #${prevIssueNumber}`);
    lines.push("");
  }

  if (nextIssueNumber) {
    lines.push("## Next", "");
    lines.push(`- #${nextIssueNumber}`);
    lines.push("");
  }

  return lines.join("\n");
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

function relayDetailText(relay, { includeState = false } = {}) {
  const line = relayDetailLine(relay, { includeState });
  return line ? line.replace(/^\*\*Relay:\*\* /, "") : null;
}

function formatMergedAt(mergedAt) {
  if (!mergedAt) return null;
  const date = new Date(mergedAt);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function formatIssueRef(issue) {
  if (!issue || !Number.isFinite(issue.number)) return null;
  return issue.url ? `[#${issue.number}](${issue.url})` : `#${issue.number}`;
}

function mergeIssueRefKey(issue) {
  return Number.isFinite(issue?.number) ? `issue:${issue.number}` : null;
}

function collectMergeIssueRefs(pr, relay) {
  const refs = [];
  const seen = new Set();

  for (const issue of pr?.closingIssuesReferences || []) {
    const key = mergeIssueRefKey(issue);
    const ref = formatIssueRef(issue);
    if (!key || !ref || seen.has(key)) continue;
    refs.push(ref);
    seen.add(key);
  }

  if (Number.isFinite(relay?.issueNumber)) {
    const fallbackIssue = { number: relay.issueNumber };
    const fallbackKey = mergeIssueRefKey(fallbackIssue);
    const fallback = formatIssueRef(fallbackIssue);
    if (fallbackKey && fallback && !seen.has(fallbackKey)) refs.push(fallback);
  }

  return refs;
}

function renderMergeComment(month, pr, relay = null) {
  const entryId = relay?.runId ? relayMergeEntryKey(relay.runId) : mergeEntryKey(month, pr.number);
  const marker = makeCommentMarker(entryId);
  const prRef = pr.url ? `[#${pr.number}](${pr.url})` : `#${pr.number}`;
  const lines = [marker, `**Merged:** ${prRef} — ${pr.title}`];
  const issueRefs = collectMergeIssueRefs(pr, relay);
  const landedAt = formatMergedAt(pr.mergedAt);
  const relayText = relayDetailText(relay);

  if (issueRefs.length === 1) {
    lines.push(`- Task: ${issueRefs[0]}`);
  } else if (issueRefs.length > 1) {
    lines.push(`- Tasks: ${issueRefs.join(", ")}`);
  }

  if (landedAt) {
    lines.push(`- Landed: ${landedAt}`);
  }

  if (relayText) {
    lines.push(`- AI: ${relayText}`);
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

function parseManagedComments(comments) {
  const managed = [];
  for (const comment of comments) {
    const entryId = parseCommentEntryId(comment.body);
    if (entryId) {
      managed.push({ id: comment.id, entryId, body: comment.body });
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

module.exports = {
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
};
