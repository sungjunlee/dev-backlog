#!/usr/bin/env node

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  GH_EXEC_DEFAULTS,
  readTriageConfig,
} = require("../../dev-backlog/scripts/lib");
const { parseMarkerMonth } = require("../../dev-backlog/scripts/progress-sync-render");

const CONFIG_PATH = path.join("backlog", "triage-config.yml");
const SNAPSHOT_DIR = path.join("backlog", "triage", ".cache");
const TRIAGE_DEFAULT_FETCH_LIMIT = 2147483647;
const GRAPHQL_PAGE_SIZE = 100;
const DEFAULT_CLOSED_ISSUE_DAYS = 180;
const DEFAULT_CLOSED_ISSUE_LIMIT = 200;
const DEFAULT_COMMENT_FETCH_CONCURRENCY = 5;
const OPEN_ISSUES_QUERY = `
  query($owner: String!, $name: String!, $pageSize: Int!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      issues(states: OPEN, first: $pageSize, after: $endCursor, orderBy: { field: CREATED_AT, direction: ASC }) {
        nodes {
          number
          title
          body
          createdAt
          updatedAt
          milestone {
            title
          }
          labels(first: 100) {
            nodes {
              name
            }
          }
          closedByPullRequestsReferences(first: 5, includeClosedPrs: true) {
            nodes {
              number
              state
              mergedAt
              url
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;
const CLOSED_ISSUES_QUERY = `
  query($searchQuery: String!, $pageSize: Int!, $endCursor: String) {
    search(type: ISSUE, query: $searchQuery, first: $pageSize, after: $endCursor) {
      nodes {
        ... on Issue {
          number
          title
          body
          closedAt
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

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
    withComments: false,
    withClosedIssues: false,
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

    if (arg === "--with-comments") {
      options.withComments = true;
      continue;
    }

    if (arg === "--with-closed-issues") {
      options.withClosedIssues = true;
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

function parseRepoParts(repo) {
  const [owner, name] = String(repo || "").split("/");
  if (!owner || !name) {
    throw new Error(`Invalid repo value: ${repo}. Expected OWNER/REPO.`);
  }
  return { owner, name };
}

function splitJsonDocuments(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];

  try {
    return [JSON.parse(text)];
  } catch {
    const documents = [];
    let start = null;
    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (isEscaped) {
          isEscaped = false;
          continue;
        }
        if (char === "\\") {
          isEscaped = true;
          continue;
        }
        if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
        continue;
      }

      if (char === "{") {
        if (depth === 0) start = index;
        depth += 1;
        continue;
      }

      if (char === "}") {
        depth -= 1;
        if (depth < 0) {
          throw new Error("Failed to parse paginated gh output: unmatched closing brace.");
        }
        if (depth === 0 && start !== null) {
          documents.push(JSON.parse(text.slice(start, index + 1)));
          start = null;
        }
      }
    }

    if (inString || depth !== 0 || documents.length === 0) {
      throw new Error("Failed to parse paginated gh output: incomplete JSON document stream.");
    }

    return documents;
  }
}

function normalizeClosingPrs(closingPrs) {
  const nodes = closingPrs?.nodes || [];
  return nodes.map((pr) => ({
    number: pr.number,
    state: pr.state,
    mergedAt: pr.mergedAt || null,
    url: pr.url || null,
  }));
}

function normalizeOpenIssueNode(issue) {
  return {
    number: issue.number,
    title: issue.title,
    body: typeof issue.body === "string" ? issue.body : "",
    labels: (issue.labels?.nodes || []).map((label) => label.name),
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    milestone: issue.milestone ? { title: issue.milestone.title } : null,
    closing_prs: normalizeClosingPrs(issue.closedByPullRequestsReferences),
  };
}

function graphqlArgs(query, variables, { paginate = false } = {}) {
  const args = ["api", "graphql"];
  for (const [key, value] of Object.entries(variables)) {
    args.push("-F", `${key}=${value}`);
  }
  args.push("-f", `query=${query}`);
  if (paginate) args.push("--paginate");
  return args;
}

function fetchOpenIssuesGraphql({ repo, limit, execFile = execFileSync }) {
  const resolvedLimit = limit ?? TRIAGE_DEFAULT_FETCH_LIMIT;
  if (resolvedLimit === 0) return [];

  const { owner, name } = parseRepoParts(repo);
  const pageSize = Math.min(resolvedLimit, GRAPHQL_PAGE_SIZE);
  const paginate = resolvedLimit > GRAPHQL_PAGE_SIZE || resolvedLimit === TRIAGE_DEFAULT_FETCH_LIMIT;
  const output = execFile(
    "gh",
    graphqlArgs(
      OPEN_ISSUES_QUERY,
      { owner, name, pageSize },
      { paginate }
    ),
    GH_EXEC_DEFAULTS
  );

  return splitJsonDocuments(output)
    .flatMap((page) => page?.data?.repository?.issues?.nodes || [])
    .map(normalizeOpenIssueNode)
    .slice(0, resolvedLimit);
}

function parsePaginatedApiArray(output) {
  const text = String(output || "").trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {}

  try {
    const parsed = JSON.parse(`[${text.replace(/\]\s*\[/g, "],[")}]`);
    return parsed.flatMap((page) => (Array.isArray(page) ? page : [page]));
  } catch (error) {
    throw new Error(`Failed to parse paginated gh array output: ${error.message}`);
  }
}

function normalizeIssueComments(comments) {
  return comments.map((comment) => ({
    author: comment.user?.login || comment.author?.login || null,
    body: typeof comment.body === "string" ? comment.body : "",
    createdAt: comment.created_at || comment.createdAt || null,
  }));
}

function fetchIssueComments({ repo, issueNumber, execFile = execFileSync }) {
  const { owner, name } = parseRepoParts(repo);
  const output = execFile(
    "gh",
    [
      "api",
      `repos/${owner}/${name}/issues/${issueNumber}/comments`,
      "--paginate",
    ],
    GH_EXEC_DEFAULTS
  );
  return normalizeIssueComments(parsePaginatedApiArray(output));
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function enrichIssuesWithComments({ repo, issues, execFile, concurrency }) {
  if (issues.length === 0) return issues;
  const commentsByIssue = await mapWithConcurrency(
    issues,
    Math.max(1, concurrency),
    async (issue) => fetchIssueComments({ repo, issueNumber: issue.number, execFile })
  );

  return issues.map((issue, index) => ({
    ...issue,
    comments: commentsByIssue[index],
  }));
}

function resolveClosedIssueDays(config) {
  const configured = Number(config?.closed_issue_days);
  if (Number.isSafeInteger(configured) && configured > 0) return configured;
  return DEFAULT_CLOSED_ISSUE_DAYS;
}

function resolveClosedIssueLimit(config) {
  const configured = Number(config?.closed_issue_limit);
  if (Number.isSafeInteger(configured) && configured > 0) return configured;
  return DEFAULT_CLOSED_ISSUE_LIMIT;
}

function resolveCommentFetchConcurrency(config) {
  const configured = Number(config?.comment_fetch_concurrency);
  if (Number.isSafeInteger(configured) && configured > 0) return configured;
  return DEFAULT_COMMENT_FETCH_CONCURRENCY;
}

function isoDateDaysAgo(generated, days) {
  const date = new Date(generated);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function fetchClosedIssues({ repo, generated, config, execFile = execFileSync }) {
  const closedIssueLimit = resolveClosedIssueLimit(config);
  const searchQuery = [
    `repo:${repo}`,
    "is:issue",
    "is:closed",
    `closed:>=${isoDateDaysAgo(generated, resolveClosedIssueDays(config))}`,
  ].join(" ");
  const output = execFile(
    "gh",
    graphqlArgs(
      CLOSED_ISSUES_QUERY,
      { searchQuery, pageSize: Math.min(closedIssueLimit, GRAPHQL_PAGE_SIZE) },
      { paginate: closedIssueLimit > GRAPHQL_PAGE_SIZE }
    ),
    GH_EXEC_DEFAULTS
  );

  return splitJsonDocuments(output)
    .flatMap((page) => page?.data?.search?.nodes || [])
    .map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: typeof issue.body === "string" ? issue.body : "",
      closedAt: issue.closedAt || null,
    }))
    .slice(0, closedIssueLimit);
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
    body: typeof issue.body === "string" ? issue.body : "",
    labels,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    milestone,
    closing_prs: Array.isArray(issue.closing_prs) ? issue.closing_prs : [],
    buckets: {
      label: classifyLabelBuckets(labels),
      theme: classifyTheme(issue.title, config),
      age: classifyAge(issue.createdAt, generated),
      activity: classifyActivity(issue.updatedAt, generated, config.activity_days),
      milestone: milestone ? "assigned" : "unassigned",
    },
    ...(Array.isArray(issue.comments) ? { comments: issue.comments } : {}),
  };
}

function isProgressIssue(issue) {
  return parseMarkerMonth(issue?.body) !== null;
}

function buildSnapshot({ issues, repo, generated, configPath = CONFIG_PATH, config, closedIssues }) {
  const snapshot = {
    generated,
    repo,
    config_path: configPath,
    issues: issues
      .filter((issue) => !isProgressIssue(issue))
      .map((issue) => classifyIssue(issue, { generated, config })),
  };

  if (Array.isArray(closedIssues)) {
    snapshot.closed_issues = closedIssues;
  }

  return snapshot;
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

function buildWarnings({ withComments, issueCount, config }) {
  if (!withComments) return [];
  const concurrency = resolveCommentFetchConcurrency(config);
  return [
    `--with-comments enabled: fetching issue comments adds ${issueCount} gh API calls (concurrency ${concurrency}).`,
  ];
}

async function collectSnapshot({
  repo,
  limit,
  withComments = false,
  withClosedIssues = false,
  dryRun = false,
  execFile = execFileSync,
  generated = new Date().toISOString(),
  config = undefined,
  configPath = CONFIG_PATH,
  snapshotDir = SNAPSHOT_DIR,
} = {}) {
  const resolvedRepo = repo || detectRepo(execFile);
  const triageConfig = config || readTriageConfig("backlog");
  const issues = fetchOpenIssuesGraphql({
    repo: resolvedRepo,
    limit,
    execFile,
  });
  const candidateIssues = issues.filter((issue) => !isProgressIssue(issue));
  const issuesWithComments = withComments
    ? await enrichIssuesWithComments({
      repo: resolvedRepo,
      issues: candidateIssues,
      execFile,
      concurrency: resolveCommentFetchConcurrency(triageConfig),
    })
    : candidateIssues;
  const closedIssues = withClosedIssues
    ? fetchClosedIssues({
      repo: resolvedRepo,
      generated,
      config: triageConfig,
      execFile,
    })
    : undefined;
  const snapshot = buildSnapshot({
    issues: issuesWithComments,
    repo: resolvedRepo,
    generated,
    configPath,
    config: triageConfig,
    closedIssues,
  });

  return {
    snapshot,
    snapshotPath: dryRun ? null : writeSnapshot(snapshot, snapshotDir),
    warnings: buildWarnings({ withComments, issueCount: candidateIssues.length, config: triageConfig }),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.error) {
    console.error(options.error);
    process.exit(1);
  }

  let result;
  try {
    result = await collectSnapshot(options);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(result.snapshot, null, 2));
    return;
  }

  if (options.dryRun) {
    for (const warning of result.warnings || []) {
      console.error(`[warn] ${warning}`);
    }
    console.log(
      `[dry-run] Collected ${result.snapshot.issues.length} open issues for ${result.snapshot.repo}.`
    );
    return;
  }

  for (const warning of result.warnings || []) {
    console.error(`[warn] ${warning}`);
  }
  console.log(
    `Wrote ${result.snapshot.issues.length} open issues to ${result.snapshotPath}.`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  GRAPHQL_PAGE_SIZE,
  DEFAULT_CLOSED_ISSUE_DAYS,
  DEFAULT_CLOSED_ISSUE_LIMIT,
  DEFAULT_COMMENT_FETCH_CONCURRENCY,
  OPEN_ISSUES_QUERY,
  CLOSED_ISSUES_QUERY,
  parseArgs,
  parseRepoFromRemoteUrl,
  parseRepoParts,
  detectRepo,
  splitJsonDocuments,
  normalizeOpenIssueNode,
  normalizeIssueComments,
  fetchOpenIssuesGraphql,
  fetchIssueComments,
  fetchClosedIssues,
  classifyLabelBuckets,
  classifyTheme,
  classifyAge,
  classifyActivity,
  classifyIssue,
  isProgressIssue,
  buildSnapshot,
  formatSnapshotFilename,
  writeSnapshot,
  collectSnapshot,
  CONFIG_PATH,
  SNAPSHOT_DIR,
  TRIAGE_DEFAULT_FETCH_LIMIT,
};
