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

function stripYamlSeparationComment(raw) {
  let quote = null;
  const firstNonSpace = raw.search(/\S/);
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (quote === "'") {
      if (char === "'" && raw[index + 1] === "'") index += 1;
      else if (char === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      if (char === "\\" && index + 1 < raw.length) index += 1;
      else if (char === '"') quote = null;
      continue;
    }
    const previousNonSpace = raw.slice(0, index).trimEnd().at(-1);
    if ((char === "'" || char === '"') &&
        (index === firstNonSpace || previousNonSpace === "[" || previousNonSpace === ",")) {
      quote = char;
      continue;
    }
    if (char === "#" && index > 0 && /[ \t]/.test(raw[index - 1])) {
      return raw.slice(0, index);
    }
  }
  return raw;
}

function parseYamlScalar(raw) {
  const value = stripYamlSeparationComment(raw).trim();
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

function isBlockScalarValue(raw) {
  const value = stripYamlSeparationComment(raw).trim();
  return /^(?:(?:[&!]\S+)\s+)*(?:[>|](?:[1-9][+-]?|[+-][1-9]?)?)$/.test(value);
}

function quotedScalarCloses(text, quote, start = 0) {
  for (let index = start; index < text.length; index += 1) {
    if (quote === "'" && text[index] === "'" && text[index + 1] === "'") {
      index += 1;
    } else if (quote === '"' && text[index] === "\\" && index + 1 < text.length) {
      index += 1;
    } else if (text[index] === quote) {
      return true;
    }
  }
  return false;
}

function parseSimpleYaml(raw) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  let physicalScalar = null;

  for (const line of raw.split(/\r?\n/)) {
    if (physicalScalar && physicalScalar.kind === "block") {
      if (!line.trim()) continue;
      const indent = line.match(/^\s*/)[0].length;
      if (indent > physicalScalar.indent) continue;
      physicalScalar = null;
    } else if (physicalScalar && physicalScalar.kind === "quoted") {
      if (quotedScalarCloses(line, physicalScalar.quote)) physicalScalar = null;
      continue;
    }
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const match = line.match(/^(\s*)([A-Za-z0-9_-]+):(.*)$/);
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
    if (isBlockScalarValue(rawValue)) {
      physicalScalar = { kind: "block", indent };
    } else {
      const scalar = stripYamlSeparationComment(rawValue).trimStart();
      const quote = scalar[0];
      if ((quote === "'" || quote === '"') && !quotedScalarCloses(scalar, quote, 1)) {
        physicalScalar = { kind: "quoted", quote };
      }
    }
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

module.exports = {
  slugify,
  escapeYaml,
  parseSimpleYaml,
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
