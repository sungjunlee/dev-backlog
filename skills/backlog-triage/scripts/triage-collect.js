#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  fetchOpenIssues,
  readTriageConfig,
} = require("../../dev-backlog/scripts/lib");

const CONFIG_PATH = path.join("backlog", "triage-config.yml");
const SNAPSHOT_DIR = path.join("backlog", "triage", ".cache");
const TRIAGE_DEFAULT_FETCH_LIMIT = 2147483647;

function parseLimitValue(value) {
  if (!/^\d+$/.test(value)) {
    return { error: `Invalid --limit value: ${value}. Expected a positive integer.` };
  }

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    return { error: `Invalid --limit value: ${value}. Expected a positive integer.` };
  }

  return { limit };
}

function parseArgs(args) {
  const options = {
    repo: undefined,
    limit: undefined,
    json: false,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--repo") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { ...options, error: "Missing value for --repo. Expected OWNER/REPO." };
      }
      options.repo = nextValue;
      index += 1;
      continue;
    }

    if (arg.startsWith("--repo=")) {
      options.repo = arg.slice("--repo=".length);
      continue;
    }

    if (arg === "--limit") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { ...options, error: "Missing value for --limit. Expected a positive integer." };
      }
      const parsed = parseLimitValue(nextValue);
      if (parsed.error) return { ...options, error: parsed.error };
      options.limit = parsed.limit;
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const parsed = parseLimitValue(arg.slice("--limit=".length));
      if (parsed.error) return { ...options, error: parsed.error };
      options.limit = parsed.limit;
      continue;
    }

    return { ...options, error: `Unknown argument: ${arg}` };
  }

  if (options.repo && !/^[^/]+\/[^/]+$/.test(options.repo)) {
    return { ...options, error: `Invalid --repo value: ${options.repo}. Expected OWNER/REPO.` };
  }

  return options;
}

function parseRepoFromRemoteUrl(remoteUrl) {
  const trimmed = String(remoteUrl || "").trim();
  const patterns = [
    /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/,
    /^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/,
    /^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return `${match[1]}/${match[2]}`;
  }

  return null;
}

function detectRepo(execFile = execFileSync) {
  const remoteUrl = execFile("git", ["remote", "get-url", "origin"], {
    encoding: "utf-8",
  }).trim();
  const repo = parseRepoFromRemoteUrl(remoteUrl);

  if (!repo) {
    throw new Error(`Unable to parse owner/repo from origin remote: ${remoteUrl}`);
  }

  return repo;
}

function normalizeLabels(labels) {
  return (labels || [])
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter(Boolean);
}

function pickLabelValue(labels, prefix, fallback) {
  const prefixed = labels.find((label) => label.startsWith(prefix));
  if (prefixed) return prefixed.slice(prefix.length);

  const legacy = {
    "type:": ["bug", "chore", "docs", "documentation", "feature", "refactor"],
    "priority:": ["critical", "high", "medium", "low"],
    "status:": ["in-progress", "blocked", "in-review"],
  };

  const legacyMatch = (legacy[prefix] || []).find((label) => labels.includes(label));
  if (legacyMatch) return legacyMatch === "documentation" ? "docs" : legacyMatch;

  return fallback;
}

function classifyLabelBuckets(labels) {
  return {
    type: pickLabelValue(labels, "type:", "uncategorized"),
    priority: pickLabelValue(labels, "priority:", "medium"),
    status: pickLabelValue(labels, "status:", "todo"),
  };
}

function daysBetween(olderIso, newerIso) {
  const older = new Date(olderIso);
  const newer = new Date(newerIso);
  return (newer.getTime() - older.getTime()) / (24 * 60 * 60 * 1000);
}

function classifyAge(createdAt, generated) {
  const ageDays = daysBetween(createdAt, generated);
  if (ageDays < 7) return "<7d";
  if (ageDays < 30) return "7-30d";
  if (ageDays < 90) return "30-90d";
  return ">90d";
}

function classifyActivity(updatedAt, generated, activityDays) {
  const ageDays = daysBetween(updatedAt, generated);
  if (ageDays < activityDays.warm) return "recent";
  if (ageDays < activityDays.cold) return "warm";
  return "cold";
}

function classifyTheme(title, config) {
  const titleText = String(title || "").toLowerCase();
  for (const [theme, keywords] of Object.entries(config.theme_keywords || {})) {
    const matches = (keywords || []).some((keyword) => titleText.includes(String(keyword).toLowerCase()));
    if (matches) return theme;
  }
  return "uncategorized";
}

function classifyIssue(issue, { generated, config }) {
  const labels = normalizeLabels(issue.labels);
  const milestone = issue.milestone?.title || null;

  return {
    number: issue.number,
    title: issue.title,
    labels,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    milestone,
    buckets: {
      label: classifyLabelBuckets(labels),
      theme: classifyTheme(issue.title, config),
      age: classifyAge(issue.createdAt, generated),
      activity: classifyActivity(issue.updatedAt, generated, config.activity_days),
      milestone: milestone ? "assigned" : "unassigned",
    },
  };
}

function buildSnapshot({ issues, repo, generated, configPath = CONFIG_PATH, config }) {
  return {
    generated,
    repo,
    config_path: configPath,
    issues: issues.map((issue) => classifyIssue(issue, { generated, config })),
  };
}

function formatSnapshotFilename(generated) {
  return `${generated.replace(/\.\d{3}Z$/, "Z").replace(/:/g, "-")}.json`;
}

function writeSnapshot(snapshot, snapshotDir = SNAPSHOT_DIR) {
  fs.mkdirSync(snapshotDir, { recursive: true });
  const filePath = path.join(snapshotDir, formatSnapshotFilename(snapshot.generated));
  // Snapshot filenames are second-resolution only; concurrent same-second runs overwrite by design.
  fs.writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`);
  return filePath;
}

function collectSnapshot({
  repo,
  limit,
  dryRun = false,
  execFile = execFileSync,
  generated = new Date().toISOString(),
  config = undefined,
  configPath = CONFIG_PATH,
  snapshotDir = SNAPSHOT_DIR,
} = {}) {
  const resolvedRepo = repo || detectRepo(execFile);
  const triageConfig = config || readTriageConfig("backlog");
  const issues = fetchOpenIssues({
    repo: resolvedRepo,
    limit,
    defaultLimit: TRIAGE_DEFAULT_FETCH_LIMIT,
    execFile,
  });
  const snapshot = buildSnapshot({
    issues,
    repo: resolvedRepo,
    generated,
    configPath,
    config: triageConfig,
  });

  return {
    snapshot,
    snapshotPath: dryRun ? null : writeSnapshot(snapshot, snapshotDir),
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.error) {
    console.error(options.error);
    process.exit(1);
  }

  let result;
  try {
    result = collectSnapshot(options);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(result.snapshot, null, 2));
    return;
  }

  if (options.dryRun) {
    console.log(
      `[dry-run] Collected ${result.snapshot.issues.length} open issues for ${result.snapshot.repo}.`
    );
    return;
  }

  console.log(
    `Wrote ${result.snapshot.issues.length} open issues to ${result.snapshotPath}.`
  );
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  parseRepoFromRemoteUrl,
  detectRepo,
  classifyLabelBuckets,
  classifyTheme,
  classifyAge,
  classifyActivity,
  classifyIssue,
  buildSnapshot,
  formatSnapshotFilename,
  writeSnapshot,
  collectSnapshot,
  CONFIG_PATH,
  SNAPSHOT_DIR,
  TRIAGE_DEFAULT_FETCH_LIMIT,
};
