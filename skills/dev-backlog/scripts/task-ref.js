#!/usr/bin/env node
/**
 * Canonical task-reference parsing, rendering, and identity helpers.
 *
 * Task refs are complete tokens: GitHub #N or configured local PREFIX-N,
 * where local IDs may use Backlog.md decimal subtask notation (N.M).
 * Provider metadata such as `PR #N` is intentionally outside this module.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_TASK_PREFIX = "BACK";
const GITHUB_ID_RE = /^[1-9]\d*$/;
const LOCAL_ID_RE = /^[1-9]\d*(?:\.[1-9]\d*)?$/;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function taskPrefix(options = {}) {
  const prefix = options.taskPrefix ?? DEFAULT_TASK_PREFIX;
  if (typeof prefix !== "string" || !prefix || /\s/.test(prefix)) {
    throw new Error("taskPrefix must be a non-empty string without whitespace");
  }
  return prefix;
}

function parseTaskRef(value, options = {}) {
  if (typeof value !== "string") return null;

  if (value.startsWith("#")) {
    const id = value.slice(1);
    return GITHUB_ID_RE.test(id) ? { tracker: "github", id, ref: value } : null;
  }

  const prefix = taskPrefix(options);
  const localPrefix = `${prefix}-`;
  if (!value.startsWith(localPrefix)) return null;
  const id = value.slice(localPrefix.length);
  return LOCAL_ID_RE.test(id) ? { tracker: "local", id, ref: value } : null;
}

function renderTaskRef(identity, options = {}) {
  if (!identity || typeof identity !== "object") {
    throw new Error("task identity must be an object");
  }

  const { tracker, id } = identity;
  if (typeof id !== "string") throw new Error("task identity id must be a string");

  let ref;
  if (tracker === "github" && GITHUB_ID_RE.test(id)) {
    ref = `#${id}`;
  } else if (tracker === "local" && LOCAL_ID_RE.test(id)) {
    if (options.taskPrefix === undefined && typeof identity.ref === "string") {
      const suffix = `-${id}`;
      const prefix = identity.ref.endsWith(suffix)
        ? identity.ref.slice(0, -suffix.length)
        : "";
      if (!prefix || /\s/.test(prefix)) throw new Error("invalid local task identity ref");
      ref = identity.ref;
    } else {
      ref = `${taskPrefix(options)}-${id}`;
    }
  } else {
    throw new Error(`invalid ${String(tracker)} task identity: ${String(id)}`);
  }

  if (identity.ref !== undefined && identity.ref !== ref) {
    throw new Error(`task identity ref ${identity.ref} does not match ${ref}`);
  }
  return ref;
}

function sameTaskIdentity(left, right) {
  return Boolean(
    left
      && right
      && typeof left.id === "string"
      && typeof right.id === "string"
      && left.tracker === right.tracker
      && left.id === right.id
  );
}

function containsTaskRef(text, identity) {
  if (typeof text !== "string" || !identity) return false;
  const ref = renderTaskRef(identity);
  const escaped = escapeRegExp(ref);
  const left = identity.tracker === "github" ? "[^A-Za-z0-9_#]" : "[^A-Za-z0-9_]";
  const right = identity.tracker === "github" ? "(?![\\d.])" : "(?![A-Za-z0-9_.-])";
  const matcher = new RegExp(`(^|${left})(${escaped})${right}`, "g");

  for (const match of text.matchAll(matcher)) {
    const refStart = match.index + match[1].length;
    if (/PR\s$/.test(text.slice(Math.max(0, refStart - 3), refStart))) continue;
    return true;
  }
  return false;
}

function parsePlanCheckbox(line, options = {}) {
  if (typeof line !== "string") return null;
  const match = line.match(/^- \[( |~|x)\] (\S+)(?:\s+(.*))?$/);
  if (!match) return null;
  const identity = parseTaskRef(match[2], options);
  if (!identity) return null;
  return {
    checkboxState: match[1],
    identity,
    title: (match[3] || "").trim(),
  };
}

function githubIssueNumber(identity) {
  return identity?.tracker === "github" ? Number(identity.id) : null;
}

function taskFileRef(identity, options = {}) {
  if (!identity) throw new Error("task identity is required");
  if (identity.tracker === "github") {
    if (!GITHUB_ID_RE.test(identity.id)) throw new Error("invalid GitHub task identity");
    return `${taskPrefix(options)}-${identity.id}`;
  }
  return renderTaskRef(identity, options);
}

function parseTaskFileName(fileName, options = {}) {
  const base = path.basename(String(fileName || ""));
  const inferred = base.match(/^(.+)-[1-9]\d*(?:\.[1-9]\d*)?(?: - .+)?\.md$/);
  const prefix = options.taskPrefix === undefined && inferred
    ? inferred[1]
    : taskPrefix(options);
  const match = base.match(
    new RegExp(`^(${escapeRegExp(prefix)}-([1-9]\\d*(?:\\.[1-9]\\d*)?))(?: - .+)?\\.md$`)
  );
  if (!match) return null;

  const tracker = options.tracker ?? "github";
  if (tracker === "github") {
    if (!GITHUB_ID_RE.test(match[2])) return null;
    return { tracker, id: match[2], ref: `#${match[2]}` };
  }
  if (tracker === "local") return { tracker, id: match[2], ref: match[1] };
  return null;
}

function cliOptions(backlogDir) {
  const { readConfig } = require("./lib.js");
  return { taskPrefix: readConfig(backlogDir).task_prefix };
}

function parsedPlanLines(file, backlogDir) {
  const options = cliOptions(backlogDir);
  return fs.readFileSync(file, "utf-8").split(/\r?\n/)
    .map((line) => ({ line, parsed: parsePlanCheckbox(line, options) }))
    .filter((entry) => entry.parsed);
}

function main() {
  const [command, file, backlogDir, marker] = process.argv.slice(2);
  if (!command || !file || !backlogDir) {
    console.error("Usage: task-ref.js plan-lines|counts|completed-file-refs <file> <backlog-dir> [marker]");
    process.exit(1);
  }

  const entries = parsedPlanLines(file, backlogDir);
  if (command === "plan-lines") {
    const filtered = marker === undefined
      ? entries
      : entries.filter(({ parsed }) => parsed.checkboxState === marker);
    process.stdout.write(filtered.map(({ line }) => line).join("\n"));
    if (filtered.length > 0) process.stdout.write("\n");
    return;
  }
  if (command === "counts") {
    const counts = { x: 0, "~": 0, " ": 0 };
    for (const { parsed } of entries) counts[parsed.checkboxState] += 1;
    process.stdout.write(`${entries.length} ${counts.x} ${counts["~"]} ${counts[" "]}\n`);
    return;
  }
  if (command === "completed-file-refs") {
    const options = cliOptions(backlogDir);
    const refs = entries
      .filter(({ parsed }) => parsed.checkboxState === "x")
      .map(({ parsed }) => taskFileRef(parsed.identity, options));
    process.stdout.write(refs.join("\n"));
    if (refs.length > 0) process.stdout.write("\n");
    return;
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

if (require.main === module) main();

module.exports = {
  DEFAULT_TASK_PREFIX,
  parseTaskRef,
  renderTaskRef,
  sameTaskIdentity,
  containsTaskRef,
  parsePlanCheckbox,
  githubIssueNumber,
  taskFileRef,
  parseTaskFileName,
};
