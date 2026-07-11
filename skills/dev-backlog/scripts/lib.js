/**
 * Shared library for dev-backlog Node scripts.
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  GH_EXEC_DEFAULTS,
  OPEN_ISSUE_COUNT_QUERY,
  OPEN_ISSUE_JSON_FIELDS,
  createGithubAdapter,
  getOpenIssueCount: getGithubOpenIssueCount,
  stripNormalizedIdentity,
} = require("./github-tracker.js");

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

const CONFIG_DEFAULTS = {
  tracker: "github",
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

function getOpenIssueCount({ repo, execFile = execFileSync } = {}) {
  return getGithubOpenIssueCount({ repo, execFile });
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
  return createGithubAdapter({ execFile })
    .list({ repo, limit, defaultLimit })
    .map(stripNormalizedIdentity);
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

/**
 * Resolve a sprint's scope key from its frontmatter (multi-track partitioning).
 * Priority: non-empty `component:` wins; else `scope:` path globs; else none.
 * A track declares one axis, never both (PRD D1).
 */
function sprintScopeKey(frontmatter) {
  const fm = frontmatter || {};
  const component = typeof fm.component === "string" ? fm.component.trim() : "";
  if (component) return { kind: "component", value: component };
  const scope = Array.isArray(fm.scope)
    ? fm.scope.map((glob) => String(glob).trim()).filter(Boolean)
    : [];
  if (scope.length) return { kind: "scope", globs: scope };
  return { kind: "none" };
}

// Reduce a path glob to a comparable directory prefix:
// "src/auth/**" -> "src/auth", "src/auth/*" -> "src/auth", "src/auth/" -> "src/auth".
function normalizeScopePrefix(glob) {
  return String(glob).replace(/\/+\**$/, "").replace(/\/+$/, "");
}

function globsOverlap(a, b) {
  const na = normalizeScopePrefix(a);
  const nb = normalizeScopePrefix(b);
  if (na === "" || nb === "") return true; // a root scope overlaps anything
  if (na === nb) return true;
  return na.startsWith(`${nb}/`) || nb.startsWith(`${na}/`); // nested paths overlap
}

/**
 * Do two sprints' scopes overlap? The single shared predicate consumed by
 * sprint-state (OVERLAPPING_TRACKS), sprint-init (refuse), and backlog-doctor.
 * component: exact equality; scope: globs: normalized path-prefix containment.
 * Cross-axis or scopeless pairs return false — "cannot prove overlap" — and the
 * doctor separately warns on two scopeless active tracks.
 */
function scopesOverlap(frontmatterA, frontmatterB) {
  const a = sprintScopeKey(frontmatterA);
  const b = sprintScopeKey(frontmatterB);
  if (a.kind === "component" && b.kind === "component") return a.value === b.value;
  if (a.kind === "scope" && b.kind === "scope") {
    return a.globs.some((ga) => b.globs.some((gb) => globsOverlap(ga, gb)));
  }
  return false;
}

module.exports = {
  slugify,
  escapeYaml,
  parseSimpleYaml,
  sprintScopeKey,
  scopesOverlap,
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
