#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { readTriageConfig } = require("../../dev-backlog/scripts/lib");

const DEFAULT_BACKLOG_DIR = "backlog";
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STALE_DAYS = 60;

const SIGNALS = Object.freeze({
  INACTIVE: "inactive",
  WONTFIX: "wontfix",
  INVALID: "invalid",
  MERGED_CLOSING_PR: "merged-closing-pr",
  DUPLICATE_OF_CLOSED: "duplicate-of-closed",
});

function usage() {
  return "Usage: triage-stale.js --snapshot PATH [--since N] [--json]";
}

function parseSinceValue(value) {
  if (!/^\d+$/.test(value)) {
    return { error: `Invalid --since value: ${value}. Expected a non-negative integer.` };
  }

  const since = Number(value);
  if (!Number.isSafeInteger(since) || since < 0) {
    return { error: `Invalid --since value: ${value}. Expected a non-negative integer.` };
  }

  return { since };
}

function parseArgs(args) {
  const options = {
    snapshotPath: undefined,
    since: undefined,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--snapshot") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { ...options, error: `Missing value for --snapshot. ${usage()}` };
      }
      options.snapshotPath = nextValue;
      index += 1;
      continue;
    }

    if (arg.startsWith("--snapshot=")) {
      options.snapshotPath = arg.slice("--snapshot=".length);
      continue;
    }

    if (arg === "--since") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { ...options, error: "Missing value for --since. Expected a non-negative integer." };
      }
      const parsed = parseSinceValue(nextValue);
      if (parsed.error) return { ...options, error: parsed.error };
      options.since = parsed.since;
      index += 1;
      continue;
    }

    if (arg.startsWith("--since=")) {
      const parsed = parseSinceValue(arg.slice("--since=".length));
      if (parsed.error) return { ...options, error: parsed.error };
      options.since = parsed.since;
      continue;
    }

    return { ...options, error: `Unknown argument: ${arg}. ${usage()}` };
  }

  if (!options.snapshotPath) {
    return { ...options, error: `Missing required --snapshot PATH. ${usage()}` };
  }

  return options;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function validateSnapshot(snapshot, snapshotPath) {
  if (!isPlainObject(snapshot)) {
    throw new Error(`Malformed snapshot at ${snapshotPath}: expected a JSON object.`);
  }

  if (typeof snapshot.generated !== "string" || !parseDate(snapshot.generated)) {
    throw new Error(`Malformed snapshot at ${snapshotPath}: expected generated to be an ISO timestamp.`);
  }

  if (!Array.isArray(snapshot.issues)) {
    throw new Error(`Malformed snapshot at ${snapshotPath}: expected issues to be an array.`);
  }

  snapshot.issues.forEach((issue, index) => {
    if (!isPlainObject(issue)) {
      throw new Error(`Malformed snapshot at ${snapshotPath}: issue[${index}] must be an object.`);
    }
    if (!Number.isInteger(issue.number)) {
      throw new Error(`Malformed snapshot at ${snapshotPath}: issue[${index}] is missing an integer number.`);
    }
    if (typeof issue.title !== "string") {
      throw new Error(`Malformed snapshot at ${snapshotPath}: issue #${issue.number} is missing a string title.`);
    }
    if (typeof issue.updatedAt !== "string" || !parseDate(issue.updatedAt)) {
      throw new Error(`Malformed snapshot at ${snapshotPath}: issue #${issue.number} has an invalid updatedAt timestamp.`);
    }
    if (!Array.isArray(issue.labels)) {
      throw new Error(`Malformed snapshot at ${snapshotPath}: issue #${issue.number} labels must be an array.`);
    }
    if (issue.milestone !== null && issue.milestone !== undefined && typeof issue.milestone !== "string") {
      throw new Error(`Malformed snapshot at ${snapshotPath}: issue #${issue.number} milestone must be a string or null.`);
    }
  });

  return snapshot;
}

function readSnapshot(snapshotPath, readFile = fs.readFileSync) {
  const resolvedPath = path.resolve(snapshotPath);

  let raw;
  try {
    raw = readFile(resolvedPath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read snapshot at ${resolvedPath}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Malformed snapshot JSON at ${resolvedPath}: ${error.message}`);
  }

  return validateSnapshot(parsed, resolvedPath);
}

function normalizeLabels(labels) {
  return (labels || [])
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter(Boolean);
}

function daysSince(olderIso, newerIso) {
  const older = parseDate(olderIso);
  const newer = parseDate(newerIso);
  if (!older || !newer) return null;
  return Math.floor((newer.getTime() - older.getTime()) / DAY_IN_MS);
}

function pickAction(signal, context = {}) {
  switch (signal) {
    case SIGNALS.INACTIVE:
    case SIGNALS.WONTFIX:
    case SIGNALS.INVALID:
    case SIGNALS.MERGED_CLOSING_PR:
      return "close";
    case SIGNALS.DUPLICATE_OF_CLOSED:
      return context.targetIssueNumber ? `merge-into:#${context.targetIssueNumber}` : "revisit";
    default:
      return context.targetIssueNumber ? `merge-into:#${context.targetIssueNumber}` : "revisit";
  }
}

function buildCandidate(issue, signal, reason, evidence, actionContext = {}) {
  return {
    number: issue.number,
    title: issue.title,
    reason,
    evidence,
    suggested_action: pickAction(signal, actionContext),
  };
}

function scanInactive(issue, thresholdDays, generated) {
  const daysSinceUpdate = daysSince(issue.updatedAt, generated);
  if (daysSinceUpdate === null) return null;

  const milestone = issue.milestone ?? null;
  if (daysSinceUpdate < thresholdDays || milestone !== null) {
    return null;
  }

  return buildCandidate(
    issue,
    SIGNALS.INACTIVE,
    `inactive/stale: no activity for ${daysSinceUpdate} days; exceeds stale_days threshold (${thresholdDays}); no milestone assigned`,
    {
      updatedAt: issue.updatedAt,
      generated,
      daysSinceUpdate,
      thresholdDays,
      milestone,
      labels: normalizeLabels(issue.labels),
    }
  );
}

function scanWontfixInvalid(issue) {
  const labels = normalizeLabels(issue.labels);
  const lowerCaseLabels = labels.map((label) => label.toLowerCase());
  const candidates = [];

  for (const target of [SIGNALS.WONTFIX, SIGNALS.INVALID]) {
    const labelIndex = lowerCaseLabels.indexOf(target);
    if (labelIndex === -1) continue;

    const matchedLabel = labels[labelIndex];
    candidates.push(
      buildCandidate(
        issue,
        target,
        `labeled ${matchedLabel}; explicit ${target} signal`,
        {
          matchedLabel,
          labels,
          updatedAt: issue.updatedAt,
          milestone: issue.milestone ?? null,
        }
      )
    );
  }

  return candidates;
}

function scanMergedClosingPr(issue) {
  const closingPrs = Array.isArray(issue.closing_prs) ? issue.closing_prs : [];
  const candidates = [];

  for (const pr of closingPrs) {
    const state = typeof pr?.state === "string" ? pr.state.toUpperCase() : "";
    if (state !== "MERGED" || typeof pr?.mergedAt !== "string" || !pr.mergedAt) continue;

    const prNumber = Number.isInteger(pr?.number) ? pr.number : null;
    const prLabel = prNumber ? `PR #${prNumber}` : "a merged closing PR";
    candidates.push(
      buildCandidate(
        issue,
        SIGNALS.MERGED_CLOSING_PR,
        `merged closing PR detected: ${prLabel} merged at ${pr.mergedAt}`,
        {
          source: "closing_prs",
          pr: {
            number: prNumber,
            state: pr.state,
            mergedAt: pr.mergedAt,
            url: typeof pr?.url === "string" ? pr.url : null,
          },
          updatedAt: issue.updatedAt,
          milestone: issue.milestone ?? null,
        }
      )
    );
  }

  return candidates;
}

function tokenizeTitle(title) {
  return new Set(
    String(title || "")
      .toLowerCase()
      .match(/[a-z0-9]+/g)?.filter((token) => token.length > 1) || []
  );
}

function jaccardSimilarity(left, right) {
  const leftTokens = [...left];
  const rightTokens = [...right];
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return { score: 0, overlap: [] };

  const overlap = leftTokens.filter((token) => right.has(token));
  return {
    score: overlap.length / union.size,
    overlap,
  };
}

function closedIssueMatches(openIssue, closedIssue, threshold = 0.8) {
  if (!Number.isInteger(closedIssue?.number) || typeof closedIssue?.title !== "string") {
    return null;
  }

  const openTitle = String(openIssue.title || "").trim().toLowerCase();
  const closedTitle = String(closedIssue.title || "").trim().toLowerCase();
  const similarity = jaccardSimilarity(tokenizeTitle(openIssue.title), tokenizeTitle(closedIssue.title));
  const exactTitle = openTitle.length > 0 && openTitle === closedTitle;
  if (!exactTitle && similarity.score < threshold) return null;

  return {
    score: Number(similarity.score.toFixed(4)),
    overlap: similarity.overlap.sort(),
    exactTitle,
  };
}

function scanDuplicateOfClosed(issue, closedIssues, { threshold = 0.8 } = {}) {
  if (!Array.isArray(closedIssues) || closedIssues.length === 0) return [];

  const candidates = [];
  for (const closedIssue of closedIssues) {
    const match = closedIssueMatches(issue, closedIssue, threshold);
    if (!match) continue;

    candidates.push(
      buildCandidate(
        issue,
        SIGNALS.DUPLICATE_OF_CLOSED,
        `duplicate of closed issue #${closedIssue.number}: title similarity ${match.score.toFixed(2)}`,
        {
          target: {
            number: closedIssue.number,
            title: closedIssue.title,
            state: closedIssue.state || "closed",
            closedAt: typeof closedIssue.closedAt === "string" ? closedIssue.closedAt : null,
            url: typeof closedIssue.url === "string" ? closedIssue.url : null,
          },
          score: match.score,
          overlap: match.overlap,
          exactTitle: match.exactTitle,
          titles: {
            open: issue.title,
            closed: closedIssue.title,
          },
        },
        { targetIssueNumber: closedIssue.number }
      )
    );
  }

  return candidates;
}

function resolveThresholdDays({ since, backlogDir = DEFAULT_BACKLOG_DIR, config } = {}) {
  if (since !== undefined) return since;
  const resolvedConfig = config || readTriageConfig(backlogDir);
  return Number.isSafeInteger(resolvedConfig.stale_days)
    ? resolvedConfig.stale_days
    : DEFAULT_STALE_DAYS;
}

function analyzeSnapshot(snapshot, { since, backlogDir = DEFAULT_BACKLOG_DIR, config } = {}) {
  const thresholdDays = resolveThresholdDays({ since, backlogDir, config });
  const candidates = [];

  for (const issue of snapshot.issues) {
    candidates.push(...scanMergedClosingPr(issue));
    candidates.push(...scanWontfixInvalid(issue));

    const inactiveCandidate = scanInactive(issue, thresholdDays, snapshot.generated);
    if (inactiveCandidate) candidates.push(inactiveCandidate);

    candidates.push(...scanDuplicateOfClosed(issue, snapshot.closed_issues));
  }

  return {
    generated: snapshot.generated,
    thresholdDays,
    candidates,
  };
}

function formatCandidate(candidate) {
  return `#${candidate.number} ${candidate.suggested_action} ${candidate.reason}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.error) {
    console.error(options.error);
    process.exit(1);
  }

  let snapshot;
  let result;
  try {
    snapshot = readSnapshot(options.snapshotPath);
    result = analyzeSnapshot(snapshot, { since: options.since });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          snapshot: path.resolve(options.snapshotPath),
          generated: result.generated,
          thresholdDays: result.thresholdDays,
          candidates: result.candidates,
        },
        null,
        2
      )
    );
    return;
  }

  if (result.candidates.length === 0) {
    console.log(`No stale or obsolete candidates found in ${path.resolve(options.snapshotPath)}.`);
    return;
  }

  for (const candidate of result.candidates) {
    console.log(formatCandidate(candidate));
  }
}

if (require.main === module) main();

module.exports = {
  SIGNALS,
  DEFAULT_BACKLOG_DIR,
  DEFAULT_STALE_DAYS,
  usage,
  parseSinceValue,
  parseArgs,
  validateSnapshot,
  readSnapshot,
  normalizeLabels,
  daysSince,
  pickAction,
  scanInactive,
  scanWontfixInvalid,
  scanMergedClosingPr,
  scanDuplicateOfClosed,
  resolveThresholdDays,
  analyzeSnapshot,
  formatCandidate,
};
