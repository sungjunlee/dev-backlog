/** Shared library for dev-backlog Node scripts. */

const fs = require("node:fs");
const path = require("node:path");
const { DEFAULT_BACKLOG_DIR } = require("./execution-root.js");
const TASK_AUTHORITIES = { github: "github", backlog: "backlog", files: "backlog", gitlab: "gitlab" };
/** First line of `<backlogDir>/.tracker`, or null when the file is absent (#476). */
function readTrackerLine(trackerPath) {
  try {
    return fs.readFileSync(trackerPath, "utf-8").split("\n")[0].trim().toLowerCase();
  } catch (error) {
    if (error.code === "EISDIR") throw new Error(`Cannot read task authority: ${trackerPath} is a directory.`);
    if (error.code !== "ENOENT") throw error;
    if (fs.existsSync(trackerPath) || isSymlink(trackerPath)) throw new Error(`Cannot read task authority: ${trackerPath} is unreadable.`);
    return null;
  }
}

function isSymlink(targetPath) {
  try { return fs.lstatSync(targetPath).isSymbolicLink(); } catch { return false; }
}

/** `.tracker` one line; absent -> "github"; `files` is the legacy spelling of `backlog`. */
function readTaskAuthority(backlogDir) {
  const trackerPath = path.join(backlogDir, ".tracker");
  const line = readTrackerLine(trackerPath);
  if (line === null) return "github";
  if (!Object.hasOwn(TASK_AUTHORITIES, line)) {
    throw new Error(`Unknown task authority "${line}" in ${trackerPath}; expected github, backlog (or files), or gitlab.`);
  }
  return TASK_AUTHORITIES[line];
}

const GH_EXEC_DEFAULTS = Object.freeze({
  encoding: "utf-8",
  maxBuffer: 50 * 1024 * 1024,
});
// Plan refs are complete GitHub Issue refs and nothing else: `#N`, N >= 1.
const ISSUE_REF_RE = /^#([1-9]\d*)$/;
const PLAN_CHECKBOX_RE = /^- \[( |~|x)\] (\S+)(?:\s+(.*))?$/;

/** `#N` -> task identity, or null. The one plan-ref parser. */
function parseIssueRef(text) {
  const match = typeof text === "string" ? text.match(ISSUE_REF_RE) : null;
  if (!match) return null;
  const id = match[1];
  return { tracker: "github", id, ref: `#${id}`, issue_number: Number(id) };
}

/** One Plan line -> `{ checkboxState, identity, title }`, or null. */
function parsePlanCheckbox(line) {
  const match = typeof line === "string" ? line.match(PLAN_CHECKBOX_RE) : null;
  if (!match) return null;
  const identity = parseIssueRef(match[2]);
  if (!identity) return null;
  return { checkboxState: match[1], identity, title: (match[3] || "").trim() };
}

/**
 * Exact `#N` mention in free text. `#11` never matches `#1`, `#42.1` is not
 * `#42`, and provider metadata (`PR #42`) is not a task ref.
 */
function containsIssueRef(text, identity) {
  if (typeof text !== "string" || !identity || !identity.ref) return false;
  const matcher = new RegExp(
    `(^|[^A-Za-z0-9_#])(${identity.ref})(?![A-Za-z0-9_]|\\.\\d)`,
    "g"
  );
  for (const match of text.matchAll(matcher)) {
    const refStart = match.index + match[1].length;
    if (/PR\s$/.test(text.slice(Math.max(0, refStart - 3), refStart))) continue;
    return true;
  }
  return false;
}

function slugify(text) {
  return text
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

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

// Path glob -> directory prefix: "src/auth/**" / "src/auth/*" / "src/auth/" -> "src/auth".
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
 * doctor separately warns when a multi-track portfolio has a scopeless track.
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
  parseSimpleYaml,
  sprintScopeKey,
  scopesOverlap,
  ISSUE_REF_RE,
  parseIssueRef,
  parsePlanCheckbox,
  containsIssueRef,
  readTaskAuthority,
  DEFAULT_BACKLOG_DIR,
  GH_EXEC_DEFAULTS,
};
