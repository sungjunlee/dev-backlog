#!/usr/bin/env node

/**
 * Resolve the effective task specification from the configured task authority.
 *
 * The resolver intentionally knows nothing about task mirrors. It reads the
 * configured adapter once, selects an explicit spec_ref when present, and
 * otherwise uses the canonical task body. A failed authority read is terminal.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { readConfig } = require("./lib.js");
const { resolveConfiguredTracker } = require("./tracker.js");

const GITHUB_RESOLUTION_FIELDS =
  "number,title,body,state,labels,milestone,assignees,createdAt,updatedAt,url";
const SPEC_REF_MARKER_RE =
  /^[ \t]{0,3}<!--\s*dev-backlog:spec_ref\s+([^\r\n]*?)\s*-->[ \t]*$/gim;
const AC_MARKER_RE =
  /^[ \t]{0,3}<!--\s*AC:BEGIN\s*-->[ \t]*$\n([\s\S]*?)^[ \t]{0,3}<!--\s*AC:END\s*-->[ \t]*$/imd;
const TASK_LIST_LINE_RE =
  /^(\s*)(?:[-*+]|\d{1,9}[.)])\s+\[([ xX])\]\s+(.+?)\s*$/;
const LIST_ITEM_LINE_RE =
  /^(\s*)((?:[-*+]|\d{1,9}[.)])[ \t]+)/;

const SOURCE_UNAVAILABLE_CODE = "TASK_SPEC_SOURCE_UNAVAILABLE";
const SPEC_REF_UNAVAILABLE_CODE = "TASK_SPEC_REF_UNAVAILABLE";
const INVALID_SPEC_REF_CODE = "TASK_SPEC_REF_INVALID";

class EffectiveTaskSpecError extends Error {
  constructor(code, message, {
    tracker,
    taskRef,
    sourceRef,
    remediation,
    cause,
  } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "EffectiveTaskSpecError";
    this.code = code;
    this.tracker = tracker;
    this.task_ref = taskRef;
    if (sourceRef !== undefined) this.source_ref = sourceRef;
    this.remediation = remediation;
  }
}

function normalizeText(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n");
}

function digestText(value) {
  return crypto.createHash("sha256").update(normalizeText(value), "utf8").digest("hex");
}

function stripCodeSpans(markdown) {
  const text = normalizeText(markdown);
  let visible = "";
  for (let index = 0; index < text.length;) {
    if (text[index] !== "`") {
      visible += text[index++];
      continue;
    }

    let runEnd = index;
    while (text[runEnd] === "`") runEnd += 1;
    const runLength = runEnd - index;
    let close = runEnd;
    while (close < text.length) {
      if (text[close] !== "`") {
        close += 1;
        continue;
      }
      let closeEnd = close;
      while (text[closeEnd] === "`") closeEnd += 1;
      if (closeEnd - close === runLength) break;
      close = closeEnd;
    }

    if (close >= text.length) {
      visible += text.slice(index, runEnd);
      index = runEnd;
      continue;
    }
    const hidden = text.slice(index, close + runLength);
    visible += hidden.replace(/[^\n]/g, " ");
    index = close + runLength;
  }
  return visible;
}

function maskHtmlComments(markdown) {
  const text = normalizeText(markdown);
  let visible = "";
  for (let index = 0; index < text.length;) {
    const open = text.indexOf("<!--", index);
    if (open < 0) {
      visible += text.slice(index);
      break;
    }
    visible += text.slice(index, open);
    const close = text.indexOf("-->", open + 4);
    if (close < 0) {
      visible += text.slice(open).replace(/[^\n]/g, " ");
      break;
    }

    const end = close + 3;
    const comment = text.slice(open, end);
    const lineStart = text.lastIndexOf("\n", open - 1) + 1;
    const nextNewline = text.indexOf("\n", end);
    const lineEnd = nextNewline < 0 ? text.length : nextNewline;
    const prefix = text.slice(lineStart, open);
    const suffix = text.slice(end, lineEnd);
    const isDirective =
      /^[ \t]{0,3}$/.test(prefix) &&
      /^[ \t]*$/.test(suffix) &&
      /^<!--\s*(?:dev-backlog:spec_ref(?:\s+[^\r\n]*)?|AC:(?:BEGIN|END))\s*-->$/i
        .test(comment);
    visible += isDirective ? comment : comment.replace(/[^\n]/g, " ");
    index = end;
  }
  return visible;
}

function markdownOutsideCode(markdown, { stripInline = false } = {}) {
  const visible = [];
  let fence = null;
  let listBaseIndent = null;
  let listContentIndent = null;
  for (const line of normalizeText(markdown).split("\n")) {
    const leading = line.match(/^[ \t]*/)[0].replace(/\t/g, "    ").length;
    const fenceMatch = line.match(/^[ \t]*(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.character &&
        fenceMatch[1].length >= fence.length &&
        leading >= fence.containerIndent &&
        leading <= fence.containerIndent + 3 &&
        !fenceMatch[2].trim()
      ) {
        fence = null;
      }
      visible.push("");
      continue;
    }
    const fenceBelongsToList =
      listBaseIndent !== null &&
      listContentIndent !== null &&
      leading >= listContentIndent;
    if (fenceMatch && (leading <= 3 || fenceBelongsToList)) {
      fence = {
        character: fenceMatch[1][0],
        length: fenceMatch[1].length,
        containerIndent: fenceBelongsToList ? listContentIndent : 0,
      };
      visible.push("");
      continue;
    }
    if (!line.trim()) {
      visible.push("");
      continue;
    }

    const listItem = line.match(LIST_ITEM_LINE_RE);
    const isListContinuation =
      listBaseIndent !== null && leading > listBaseIndent;
    if (listItem && (leading < 4 || isListContinuation)) {
      if (leading < 4) listBaseIndent = leading;
      listContentIndent =
        leading + listItem[2].replace(/\t/g, "    ").length;
      visible.push(line);
      continue;
    }
    if (isListContinuation) {
      visible.push(line);
      continue;
    }
    listBaseIndent = null;
    listContentIndent = null;
    if (leading >= 4) {
      visible.push("");
      continue;
    }
    visible.push(line);
  }
  const outsideBlocksAndComments = maskHtmlComments(visible.join("\n"));
  return stripInline
    ? stripCodeSpans(outsideBlocksAndComments)
    : outsideBlocksAndComments;
}

function explicitSpecRef(task, requestedSpecRef) {
  const candidates = [];
  if (requestedSpecRef !== undefined && requestedSpecRef !== null) {
    const requested = String(requestedSpecRef).trim();
    if (!requested) {
      throw new EffectiveTaskSpecError(
        INVALID_SPEC_REF_CODE,
        "An explicit spec_ref cannot be empty.",
        {
          tracker: task.tracker,
          taskRef: task.ref,
          remediation:
            "Provide one non-empty repository-relative spec_ref or remove the explicit selection.",
        }
      );
    }
    candidates.push(requested);
  } else if (Object.hasOwn(task, "spec_ref")) {
    if (typeof task.spec_ref !== "string" || !task.spec_ref.trim()) {
      throw new EffectiveTaskSpecError(
        INVALID_SPEC_REF_CODE,
        `Task ${task.ref || task.id || ""} has an invalid empty spec_ref.`,
        {
          tracker: task.tracker,
          taskRef: task.ref,
          remediation:
            "Set spec_ref to one non-empty repository-relative path or remove the field.",
        }
      );
    }
    candidates.push(task.spec_ref.trim());
  } else {
    for (
      const match of markdownOutsideCode(task.body, { stripInline: true })
        .matchAll(SPEC_REF_MARKER_RE)
    ) {
      const markerRef = match[1].trim();
      if (!markerRef) {
        throw new EffectiveTaskSpecError(
          INVALID_SPEC_REF_CODE,
          `Task ${task.ref || task.id || ""} declares an empty spec_ref marker.`,
          {
            tracker: task.tracker,
            taskRef: task.ref,
            remediation:
              "Give the marker one repository-relative path or remove the marker.",
          }
        );
      }
      candidates.push(markerRef);
    }
  }

  const unique = [...new Set(candidates)];
  if (unique.length > 1) {
    throw new EffectiveTaskSpecError(
      INVALID_SPEC_REF_CODE,
      `Task ${task.ref || task.id || ""} declares conflicting spec_ref values: ` +
        `${unique.join(", ")}.`,
      {
        tracker: task.tracker,
        taskRef: task.ref,
        remediation:
          "Keep exactly one explicit spec_ref on the canonical task before retrying.",
      }
    );
  }
  return unique[0] || null;
}

function acceptanceCriteriaSection(markdown) {
  const text = markdownOutsideCode(markdown);
  const structuralText = stripCodeSpans(text);
  const marked = AC_MARKER_RE.exec(structuralText);
  if (marked) {
    const [start, end] = marked.indices[1];
    return text.slice(start, end);
  }

  const structuralLines = structuralText.split("\n");
  const lines = text.split("\n");
  const heading = /^(#{1,6})\s+(?:acceptance criteria|acceptance criterion|ac)\s*#*\s*$/i;
  const start = structuralLines.findIndex((line) => heading.test(line.trim()));
  if (start < 0) return text;

  const level = structuralLines[start].trim().match(/^#+/)[0].length;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const next = structuralLines[index].match(/^(#{1,6})\s+/);
    if (next && next[1].length <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

function parseAcceptanceCriteria(markdown) {
  const criteria = [];
  const lines = acceptanceCriteriaSection(markdown).split("\n");
  for (let index = 0; index < lines.length;) {
    const match = lines[index].match(TASK_LIST_LINE_RE);
    if (!match) {
      index += 1;
      continue;
    }
    const baseIndent = match[1].replace(/\t/g, "    ").length;
    const content = [match[3].trim()];
    let next = index + 1;
    let pendingBlankLines = 0;
    while (next < lines.length) {
      const line = lines[next];
      if (!line.trim()) {
        pendingBlankLines += 1;
        next += 1;
        continue;
      }
      const indent = line.match(/^[ \t]*/)[0].replace(/\t/g, "    ").length;
      if (TASK_LIST_LINE_RE.test(line)) break;
      const peerListItem =
        indent <= baseIndent && LIST_ITEM_LINE_RE.test(line);
      const heading = indent <= baseIndent && /^#{1,6}\s+/.test(line);
      if (peerListItem || heading) break;
      if (indent <= baseIndent && pendingBlankLines > 0) break;
      while (pendingBlankLines > 0) {
        content.push("");
        pendingBlankLines -= 1;
      }
      content.push(line.trimEnd());
      next += 1;
    }
    criteria.push(Object.freeze({
      text: content.join("\n").trim(),
      checked: match[2].toLowerCase() === "x",
    }));
    index = next;
  }
  return Object.freeze(criteria);
}

function normalizeLifecycle(task) {
  const rawState = String(task.state ?? "").trim().toLowerCase();
  const rawStatus = String(task.status ?? "").trim();
  let state;
  if (rawState === "open" || rawState === "closed") {
    state = rawState;
  } else if (/^done$/i.test(rawStatus)) {
    state = "closed";
  } else {
    state = "open";
  }

  const lifecycle = { state };
  if (rawStatus) lifecycle.status = rawStatus;
  if (task.updatedAt || task.updated_date) {
    lifecycle.updated_at = String(task.updatedAt || task.updated_date);
  }
  return Object.freeze(lifecycle);
}

function taskBodySourceRef(task) {
  if (typeof task.url === "string" && task.url) return `${task.url}#issue-body`;
  return `${task.ref || task.id}#issue-body`;
}

function resolveRepositoryPath(sourceRef, rootDir) {
  if (typeof sourceRef !== "string" || !sourceRef.trim()) {
    throw new Error("spec_ref must be a non-empty repository-relative path");
  }
  const ref = sourceRef.trim();
  if (path.isAbsolute(ref) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(ref)) {
    throw new Error("spec_ref must be a repository-relative path");
  }
  const root = path.resolve(rootDir);
  const candidate = path.resolve(root, ref);
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("spec_ref escapes the repository root");
  }
  const realRoot = fs.realpathSync(root);
  const realCandidate = fs.realpathSync(candidate);
  const realRelative = path.relative(realRoot, realCandidate);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error("spec_ref resolves outside the repository root");
  }
  return realCandidate;
}

function loadRepositorySpec(sourceRef, { rootDir = process.cwd() } = {}) {
  return fs.readFileSync(resolveRepositoryPath(sourceRef, rootDir), "utf8");
}

function serializeEffectiveTaskSpecError(error) {
  if (!(error instanceof EffectiveTaskSpecError)) return null;
  const serialized = {
    code: error.code,
    tracker: error.tracker,
    task_ref: error.task_ref,
    message: error.message,
    remediation: error.remediation,
  };
  if (error.source_ref !== undefined) serialized.source_ref = error.source_ref;
  return serialized;
}

function resolveEffectiveTaskSpec(resolved, taskRef, {
  repo,
  specRef,
  rootDir = process.cwd(),
  loadSpec = loadRepositorySpec,
} = {}) {
  if (
    !resolved ||
    typeof resolved.tracker !== "string" ||
    !resolved.adapter ||
    typeof resolved.adapter.read !== "function"
  ) {
    throw new TypeError("resolveEffectiveTaskSpec requires a resolved tracker.");
  }

  let task;
  try {
    const readOptions = { repo };
    if (resolved.tracker === "github") readOptions.fields = GITHUB_RESOLUTION_FIELDS;
    task = resolved.adapter.read(taskRef, readOptions);
  } catch (cause) {
    throw new EffectiveTaskSpecError(
      SOURCE_UNAVAILABLE_CODE,
      `Cannot resolve ${String(taskRef)} from configured tracker ` +
        `"${resolved.tracker}": ${cause.message || String(cause)}. ` +
        "Execution stopped; no task mirror fallback was attempted.",
      {
        tracker: resolved.tracker,
        taskRef: String(taskRef),
        remediation:
          `Restore access to tracker "${resolved.tracker}" and retry the live task read. ` +
          "A legacy task mirror is diagnostic evidence only.",
        cause,
      }
    );
  }

  const selectedSpecRef = explicitSpecRef(task, specRef);
  let effectiveSpec;
  let sourceRef;
  if (selectedSpecRef) {
    sourceRef = selectedSpecRef;
    try {
      effectiveSpec = normalizeText(loadSpec(selectedSpecRef, { rootDir, task }));
    } catch (cause) {
      throw new EffectiveTaskSpecError(
        SPEC_REF_UNAVAILABLE_CODE,
        `Cannot load explicit spec_ref "${selectedSpecRef}" for ${task.ref}: ` +
          `${cause.message || String(cause)}. Execution stopped.`,
        {
          tracker: resolved.tracker,
          taskRef: task.ref || String(taskRef),
          sourceRef: selectedSpecRef,
          remediation:
            "Repair or remove the explicit spec_ref on the canonical task, then retry. " +
            "The Issue body and task mirrors were not used as fallback authority.",
          cause,
        }
      );
    }
  } else {
    effectiveSpec = normalizeText(task.body);
    sourceRef = taskBodySourceRef(task);
  }

  const digest = digestText(effectiveSpec);
  return Object.freeze({
    effective_spec: effectiveSpec,
    acceptance_criteria: parseAcceptanceCriteria(effectiveSpec),
    lifecycle: normalizeLifecycle(task),
    source_ref: sourceRef,
    source_revision: `sha256:${digest}`,
    source_digest: digest,
  });
}

function parseCli(argv) {
  const options = { backlogDir: "backlog", rootDir: process.cwd() };
  let taskRef;
  const takeValue = (flag, index) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${flag} requires a value`);
    }
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--repo") options.repo = takeValue(arg, index++);
    else if (arg === "--spec-ref") options.specRef = takeValue(arg, index++);
    else if (arg === "--backlog-dir") options.backlogDir = takeValue(arg, index++);
    else if (arg === "--root") options.rootDir = takeValue(arg, index++);
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else if (taskRef === undefined) taskRef = arg;
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  if (!taskRef) {
    throw new Error(
      "Usage: effective-task-spec.js TASK_REF [--repo OWNER/REPO] " +
        "[--spec-ref PATH] [--backlog-dir PATH] [--root PATH]"
    );
  }
  return { taskRef, options };
}

function main(argv = process.argv.slice(2)) {
  try {
    const { taskRef, options } = parseCli(argv);
    const config = readConfig(options.backlogDir);
    const resolved = resolveConfiguredTracker(config, {
      backlogDir: options.backlogDir,
    });
    const result = resolveEffectiveTaskSpec(resolved, taskRef, options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const serialized = serializeEffectiveTaskSpecError(error);
    if (serialized) {
      process.stderr.write(`${JSON.stringify({ error: serialized })}\n`);
    } else {
      process.stderr.write(`${error.message || String(error)}\n`);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  GITHUB_RESOLUTION_FIELDS,
  SOURCE_UNAVAILABLE_CODE,
  SPEC_REF_UNAVAILABLE_CODE,
  INVALID_SPEC_REF_CODE,
  EffectiveTaskSpecError,
  acceptanceCriteriaSection,
  digestText,
  explicitSpecRef,
  loadRepositorySpec,
  maskHtmlComments,
  markdownOutsideCode,
  stripCodeSpans,
  normalizeLifecycle,
  parseCli,
  parseAcceptanceCriteria,
  resolveEffectiveTaskSpec,
  serializeEffectiveTaskSpecError,
};
