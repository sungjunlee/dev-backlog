/**
 * Shared library for dev-backlog Node scripts.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function slugify(text) {
  return text
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function escapeYaml(text) {
  if (/[:"'#{}\[\]|>&*!%@`]/.test(text) || text !== text.trim()) {
    return "'" + text.replace(/'/g, "''") + "'";
  }
  return text;
}

/** Default options for gh CLI execFileSync calls (prevents silent truncation). */
const GH_EXEC_DEFAULTS = {
  encoding: "utf-8",
  maxBuffer: 50 * 1024 * 1024,
};

const CONFIG_DEFAULTS = {
  task_prefix: "BACK",
  default_status: "To Do",
  statuses: ["To Do", "In Progress", "Done"],
};

const TRIAGE_CONFIG_DEFAULTS = {
  theme_keywords: {},
  activity_days: {
    warm: 14,
    cold: 60,
  },
  stale_days: 60,
  duplicate_threshold: 0.75,
};

const OPEN_ISSUE_COUNT_QUERY =
  "query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { issues(states: OPEN) { totalCount } } }";
const OPEN_ISSUE_JSON_FIELDS = "number,title,body,labels,milestone,assignees,createdAt,updatedAt";

function stripQuotes(text) {
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

function parseInlineArray(raw) {
  const inner = raw.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(",").map((part) => stripQuotes(part.trim()));
}

function parseYamlScalar(raw) {
  const value = raw.trim();
  if (!value) return "";
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return stripQuotes(value);
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    return parseInlineArray(value);
  }
  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function parseSimpleYaml(raw) {
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const match = line.match(/^(\s*)([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) continue;

    const indent = match[1].length;
    const key = match[2];
    const rawValue = match[3] || "";

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].value;
    if (!rawValue.trim()) {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
      continue;
    }

    parent[key] = parseYamlScalar(rawValue);
  }

  return root;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeConfig(defaults, parsed) {
  const merged = { ...defaults };
  for (const [key, value] of Object.entries(parsed || {})) {
    if (isPlainObject(value) && isPlainObject(defaults[key])) {
      merged[key] = mergeConfig(defaults[key], value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function readYamlConfig(configPath, defaults) {
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return mergeConfig(defaults, parseSimpleYaml(raw));
  } catch {
    return mergeConfig(defaults, {});
  }
}

/**
 * Read backlog/config.yml with simple YAML key: value parsing.
 * Returns merged config (file values override defaults).
 * Gracefully falls back to defaults on missing/malformed file.
 */
function readConfig(backlogDir) {
  return readYamlConfig(path.join(backlogDir || "backlog", "config.yml"), CONFIG_DEFAULTS);
}

function readTriageConfig(backlogDir) {
  return readYamlConfig(
    path.join(backlogDir || "backlog", "triage-config.yml"),
    TRIAGE_CONFIG_DEFAULTS
  );
}

function buildIssueCountArgs(repo) {
  if (!repo) {
    return [
      "api",
      "graphql",
      "-F",
      "owner={owner}",
      "-F",
      "name={repo}",
      "-f",
      `query=${OPEN_ISSUE_COUNT_QUERY}`,
      "--jq",
      ".data.repository.issues.totalCount",
    ];
  }

  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error(`Invalid repo value: ${repo}. Expected OWNER/REPO.`);
  }

  return [
    "api",
    "graphql",
    "-F",
    `owner=${owner}`,
    "-F",
    `name=${name}`,
    "-f",
    `query=${OPEN_ISSUE_COUNT_QUERY}`,
    "--jq",
    ".data.repository.issues.totalCount",
  ];
}

function getOpenIssueCount({ repo, execFile = execFileSync } = {}) {
  const out = execFile("gh", buildIssueCountArgs(repo), GH_EXEC_DEFAULTS).trim();
  const count = Number.parseInt(out, 10);

  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Invalid issue count from gh: ${out}`);
  }

  return count;
}

/**
 * Fetch open GitHub issues via `gh issue list`.
 *
 * When `defaultLimit` is provided, the helper uses that limit directly to avoid
 * a separate count fetch. Otherwise, omitted `limit` falls back to a GraphQL
 * count lookup so callers can still fetch "all open issues" without choosing a
 * cap themselves. `execFile` is injectable so tests can stub `gh` without
 * spawning a process.
 */
function fetchOpenIssues({ repo, limit, defaultLimit, execFile = execFileSync } = {}) {
  const resolvedLimit = limit ?? defaultLimit ?? getOpenIssueCount({ repo, execFile });
  if (resolvedLimit === 0) return [];

  const args = ["issue", "list", "--state", "open", "--limit", String(resolvedLimit)];
  if (repo) args.push("--repo", repo);
  args.push("--json", OPEN_ISSUE_JSON_FIELDS);

  return JSON.parse(execFile("gh", args, GH_EXEC_DEFAULTS));
}

/**
 * Estimate task size from GitHub labels.
 * Size labels (size:S/M/L) override type labels when both present.
 */
function estimateSize(labels) {
  // Size labels take priority (most specific)
  for (const l of labels) {
    if (l === "size:S") return "~15min";
    if (l === "size:M") return "~1hr";
    if (l === "size:L") return "~2hr";
  }
  // Type labels
  for (const l of labels) {
    if (l === "bug" || l === "type:bug") return "~30min";
    if (l === "chore" || l === "type:chore") return "~15min";
    if (l === "feature" || l === "type:feature") return "~1hr";
    if (l === "refactor" || l === "type:refactor") return "~1hr";
    if (l === "docs" || l === "documentation" || l === "type:docs") return "~20min";
  }
  return "";
}

module.exports = {
  slugify,
  escapeYaml,
  readConfig,
  readTriageConfig,
  estimateSize,
  CONFIG_DEFAULTS,
  TRIAGE_CONFIG_DEFAULTS,
  GH_EXEC_DEFAULTS,
  OPEN_ISSUE_COUNT_QUERY,
  OPEN_ISSUE_JSON_FIELDS,
  getOpenIssueCount,
  fetchOpenIssues,
};
