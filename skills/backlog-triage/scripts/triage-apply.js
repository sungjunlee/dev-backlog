#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("node:child_process");
const { ANCHOR_PATTERN, parseAnchor } = require("./triage-report.js");

const DEFAULT_TRIAGE_DIR = path.join("backlog", "triage");
const CHECKBOX_PATTERN = /^\s*-\s+\[([ xX])\]\s+/;
const SUPPORTED_VERBS = new Set([
  "close",
  "revisit",
  "close-duplicate",
  "set-priority",
  "assign-milestone",
]);
const UNKNOWN_PRIORITY_PLACEHOLDER = "priority:<existing-if-any>";

function usage() {
  return "Usage: triage-apply.js <report.md> [--apply] [--yes] [--json]";
}

function parseArgs(args) {
  const options = {
    reportPath: undefined,
    apply: false,
    yes: false,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--yes") {
      options.yes = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg.startsWith("--")) {
      return { ...options, error: `Unknown argument: ${arg}. ${usage()}` };
    }

    if (options.reportPath) {
      return { ...options, error: `Expected exactly one report path. ${usage()}` };
    }

    options.reportPath = arg;
  }

  if (!options.reportPath) {
    return { ...options, error: `Missing required report.md path. ${usage()}` };
  }

  return options;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeArgs(args) {
  const source = isPlainObject(args) ? args : {};
  const normalized = {};

  for (const key of Object.keys(source).sort()) {
    const value = source[key];
    if (typeof value === "string") {
      normalized[key] = value.trim();
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      normalized[key] = value;
      continue;
    }
    normalized[key] = String(value).trim();
  }

  return normalized;
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildActionKey(action) {
  return `${action.verb}|${action.issueNumber}|${stableSerialize(action.normalizedArgs || normalizeArgs(action.args))}`;
}

function parseFrontmatter(text) {
  const lines = String(text || "").split(/\r?\n/);
  if (lines[0] !== "---") return {};

  const endIndex = lines.indexOf("---", 1);
  if (endIndex === -1) {
    throw new Error("Malformed report: frontmatter block is missing its closing --- marker.");
  }

  const frontmatter = {};
  for (let index = 1; index < endIndex; index += 1) {
    const line = lines[index];
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

function parseReport(text) {
  const source = String(text || "");
  if (source.includes("<!-- AC:BEGIN -->")) {
    throw new Error("Malformed report: triage reports must not contain dev-backlog AC markers.");
  }

  const lines = source.split(/\r?\n/);
  const frontmatter = parseFrontmatter(source);
  const anchors = [];
  const parsed = {
    anchors: 0,
    checked: 0,
    unchecked: 0,
    unknown_verb: 0,
  };

  for (let index = 0; index < lines.length; index += 1) {
    const anchor = parseAnchor(lines[index]);
    if (!anchor) continue;

    let checkboxIndex = index + 1;
    while (checkboxIndex < lines.length && lines[checkboxIndex].trim() === "") {
      checkboxIndex += 1;
    }

    const checkboxLine = lines[checkboxIndex];
    const checkboxMatch = checkboxLine ? checkboxLine.match(CHECKBOX_PATTERN) : null;
    if (!checkboxMatch) {
      throw new Error(
        `Malformed report: triage anchor on line ${index + 1} must be followed by a checkbox line.`
      );
    }

    const checked = checkboxMatch[1].toLowerCase() === "x";
    const knownVerb = SUPPORTED_VERBS.has(anchor.verb);
    const normalizedArgs = normalizeArgs(anchor.args);
    const entry = {
      verb: anchor.verb,
      issueNumber: anchor.issueNumber,
      args: anchor.args,
      normalizedArgs,
      checked,
      knownVerb,
      key: `${anchor.verb}|${anchor.issueNumber}|${stableSerialize(normalizedArgs)}`,
      anchorLine: index + 1,
      checkboxLine: checkboxIndex + 1,
    };

    anchors.push(entry);
    parsed.anchors += 1;
    if (checked) {
      parsed.checked += 1;
    } else {
      parsed.unchecked += 1;
    }
    if (!knownVerb) {
      parsed.unknown_verb += 1;
    }
  }

  return { frontmatter, anchors, parsed };
}

function dedupActions(anchors) {
  const deduped = new Map();

  for (const anchor of anchors) {
    const existing = deduped.get(anchor.key);
    if (!existing) {
      deduped.set(anchor.key, {
        verb: anchor.verb,
        issueNumber: anchor.issueNumber,
        args: anchor.args,
        normalizedArgs: anchor.normalizedArgs,
        checked: anchor.checked,
        knownVerb: anchor.knownVerb,
        key: anchor.key,
        occurrences: [
          {
            anchorLine: anchor.anchorLine,
            checkboxLine: anchor.checkboxLine,
            checked: anchor.checked,
          },
        ],
      });
      continue;
    }

    if (anchor.checked) {
      existing.checked = true;
    }
    existing.occurrences.push({
      anchorLine: anchor.anchorLine,
      checkboxLine: anchor.checkboxLine,
      checked: anchor.checked,
    });
  }

  return [...deduped.values()];
}

function formatRevisitComment(reason) {
  return `triage: revisit — ${String(reason || "").trim()}`;
}

function formatDuplicateComment(target, reason) {
  const targetRef = String(target || "").trim();
  const reasonText = String(reason || "").trim();
  return reasonText ? `Duplicate of ${targetRef}. ${reasonText}` : `Duplicate of ${targetRef}.`;
}

function buildPriorityEditCommand(issueNumber, targetValue, currentPriorityLabels) {
  const issue = String(issueNumber);
  const targetLabel = `priority:${String(targetValue || "").trim()}`;
  const labels = Array.isArray(currentPriorityLabels)
    ? currentPriorityLabels.map((label) => String(label).trim()).filter(Boolean)
    : [];
  const uniqueLabels = [...new Set(labels)];
  const toRemove = uniqueLabels.filter((label) => label.startsWith("priority:") && label !== targetLabel);
  const hasTarget = uniqueLabels.includes(targetLabel);

  if (hasTarget && toRemove.length === 0) {
    return [];
  }

  const argv = ["issue", "edit", issue, "--add-label", targetLabel];
  for (const label of toRemove) {
    argv.push("--remove-label", label);
  }
  return [argv];
}

function toGhCommands(action, context = {}) {
  const issue = String(action.issueNumber);
  const args = action.args || {};

  switch (action.verb) {
    case "close":
      return [
        ["issue", "comment", issue, "-b", String(args.reason || "").trim()],
        ["issue", "close", issue],
      ];
    case "revisit":
      return [
        ["issue", "comment", issue, "-b", formatRevisitComment(args.reason)],
      ];
    case "close-duplicate":
      return [
        ["issue", "comment", issue, "-b", formatDuplicateComment(args.target, args.reason)],
        ["issue", "close", issue, "-r", "not planned"],
      ];
    case "set-priority":
      if (Array.isArray(context.currentPriorityLabels)) {
        return buildPriorityEditCommand(issue, args.value, context.currentPriorityLabels);
      }
      return [
        ["issue", "view", issue, "--json", "labels"],
        ["issue", "edit", issue, "--add-label", `priority:${String(args.value || "").trim()}`, "--remove-label", UNKNOWN_PRIORITY_PLACEHOLDER],
      ];
    case "assign-milestone":
      return [
        ["issue", "edit", issue, "--milestone", String(args.name || "").trim()],
      ];
    default:
      return [];
  }
}

function quoteShellArg(value) {
  const source = String(value);
  if (/^[A-Za-z0-9_./:#=-]+$/.test(source)) return source;
  return `'${source.replace(/'/g, `'\"'\"'`)}'`;
}

function formatGhCommand(argv) {
  return `gh ${argv.map((arg) => quoteShellArg(arg)).join(" ")}`;
}

function trimStderr(stderr) {
  return String(stderr || "").trim().slice(-500);
}

function runGh(argv, { execFile = execFileSync } = {}) {
  try {
    const stdout = execFile("gh", argv, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      status: 0,
      stdout: stdout || "",
      stderr: "",
    };
  } catch (error) {
    return {
      status: error.status || 1,
      stdout: typeof error.stdout === "string" ? error.stdout : error.stdout?.toString?.("utf-8") || "",
      stderr: typeof error.stderr === "string" ? error.stderr : error.stderr?.toString?.("utf-8") || error.message,
    };
  }
}

function parseGhLabels(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse gh issue view JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.labels)) {
    throw new Error("Malformed gh issue view response: expected { labels: [] }.");
  }

  return parsed.labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter(Boolean);
}

function extractCommandArrays(value) {
  if (!Array.isArray(value)) return [];
  if (value.every((entry) => typeof entry === "string")) {
    return [value];
  }
  return value.filter(
    (entry) => Array.isArray(entry) && entry.every((part) => typeof part === "string")
  );
}

function readApplyLog(logPath, readFile = fs.readFileSync) {
  let raw;
  try {
    raw = readFile(logPath, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        entries: [],
        appliedCommandsByAction: new Map(),
      };
    }
    throw new Error(`Failed to read apply log at ${logPath}: ${error.message}`);
  }

  const entries = [];
  const appliedCommandsByAction = new Map();
  const lines = raw.split(/\r?\n/).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    let entry;
    try {
      entry = JSON.parse(lines[index]);
    } catch (error) {
      throw new Error(`Malformed apply log at ${logPath}: line ${index + 1} is not valid JSON.`);
    }

    entries.push(entry);
    if (entry.result !== "applied") continue;
    if (typeof entry.verb !== "string" || !Number.isInteger(entry.issue)) continue;

    const key = buildActionKey({
      verb: entry.verb,
      issueNumber: entry.issue,
      args: entry.args || {},
      normalizedArgs: normalizeArgs(entry.args || {}),
    });
    const commands = extractCommandArrays(entry.gh_argv);
    if (commands.length === 0) continue;

    if (!appliedCommandsByAction.has(key)) {
      appliedCommandsByAction.set(key, new Set());
    }
    const commandSet = appliedCommandsByAction.get(key);
    for (const command of commands) {
      commandSet.add(stableSerialize(command));
    }
  }

  return {
    entries,
    appliedCommandsByAction,
  };
}

function appendLogLine(logPath, entry, appendFile = fs.appendFileSync, mkdir = fs.mkdirSync) {
  mkdir(path.dirname(logPath), { recursive: true });
  appendFile(logPath, `${JSON.stringify(entry)}\n`);
}

function buildLogEntry(action, result, ghArgv, timestamp, extra = {}) {
  const entry = {
    timestamp,
    issue: action.issueNumber,
    verb: action.verb,
    args: action.args,
    result,
    gh_argv: ghArgv,
  };

  if (extra.stderr_tail) {
    entry.stderr_tail = trimStderr(extra.stderr_tail);
  }

  return entry;
}

function resolveReportDate(frontmatter, nowIso) {
  const generated = String(frontmatter.generated || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(generated)) {
    return generated;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(generated)) {
    return generated.slice(0, 10);
  }
  return String(nowIso).slice(0, 10);
}

function resolveLogPath(reportDate, cwd) {
  return path.resolve(cwd, DEFAULT_TRIAGE_DIR, `${reportDate}-apply.log`);
}

function readLineSync(inputFd = 0) {
  const buffer = Buffer.alloc(1);
  let line = "";

  while (true) {
    const bytesRead = fs.readSync(inputFd, buffer, 0, 1, null);
    if (bytesRead === 0) break;
    const char = buffer.toString("utf-8", 0, bytesRead);
    if (char === "\n") break;
    if (char !== "\r") line += char;
  }

  return line;
}

function confirmApply({ output = process.stderr, inputFd = 0 } = {}) {
  output.write("Type `yes` to proceed: ");
  return readLineSync(inputFd).trim() === "yes";
}

function ensureApplyAllowed(options, deps) {
  if (!options.apply) return;
  if (options.yes) return;

  const stdinIsTTY = deps.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const stdoutIsTTY = deps.stdoutIsTTY ?? Boolean(process.stdout.isTTY);

  if (!stdinIsTTY || !stdoutIsTTY) {
    throw new Error("Refusing to mutate GitHub in non-interactive mode without --yes. Re-run with --apply --yes.");
  }

  const confirmed = (deps.confirmApply || confirmApply)({
    output: deps.stderr || process.stderr,
    inputFd: deps.inputFd ?? 0,
  });

  if (!confirmed) {
    throw new Error("Apply aborted. Re-run with --apply --yes to skip confirmation.");
  }
}

function recordLog(logPath, action, result, ghArgv, deps, extra = {}) {
  const timestamp = deps.now();
  const entry = buildLogEntry(action, result, ghArgv, timestamp, extra);
  appendLogLine(logPath, entry, deps.appendFile, deps.mkdir);
  return entry;
}

function applyAcceptedAction(action, context) {
  const actionKey = action.key || buildActionKey(action);
  const appliedCommands = context.appliedCommandsByAction.get(actionKey) || new Set();
  let plannedCommands;

  if (action.verb === "set-priority") {
    if (appliedCommands.size > 0) {
      const alreadyEntry = recordLog(context.logPath, action, "already-applied", [], context.deps);
      return {
        ok: true,
        action: {
          verb: action.verb,
          issueNumber: action.issueNumber,
          args: action.args,
          gh_argv: [],
          result: "already-applied",
          log: alreadyEntry,
        },
      };
    }

    const viewArgv = ["issue", "view", String(action.issueNumber), "--json", "labels"];
    const viewResult = context.deps.runGh(viewArgv);
    if (viewResult.status !== 0) {
      const errorEntry = recordLog(context.logPath, action, "error", [viewArgv], context.deps, {
        stderr_tail: viewResult.stderr,
      });
      return {
        ok: false,
        error: errorEntry,
      };
    }

    let labels;
    try {
      labels = parseGhLabels(viewResult.stdout);
    } catch (error) {
      const errorEntry = recordLog(context.logPath, action, "error", [viewArgv], context.deps, {
        stderr_tail: error.message,
      });
      return {
        ok: false,
        error: errorEntry,
      };
    }

    plannedCommands = toGhCommands(action, { currentPriorityLabels: labels });
    if (plannedCommands.length === 0) {
      const alreadyEntry = recordLog(context.logPath, action, "already-applied", [], context.deps);
      return {
        ok: true,
        action: {
          verb: action.verb,
          issueNumber: action.issueNumber,
          args: action.args,
          gh_argv: [],
          result: "already-applied",
          log: alreadyEntry,
        },
      };
    }
  } else {
    plannedCommands = toGhCommands(action);
  }

  const missingCommands = plannedCommands.filter(
    (argv) => !appliedCommands.has(stableSerialize(argv))
  );

  if (missingCommands.length === 0) {
    const alreadyEntry = recordLog(context.logPath, action, "already-applied", plannedCommands, context.deps);
    return {
      ok: true,
      action: {
        verb: action.verb,
        issueNumber: action.issueNumber,
        args: action.args,
        gh_argv: plannedCommands,
        result: "already-applied",
        log: alreadyEntry,
      },
    };
  }

  const executedCommands = [];
  for (const argv of missingCommands) {
    const result = context.deps.runGh(argv);
    if (result.status !== 0) {
      const errorEntry = recordLog(context.logPath, action, "error", [argv], context.deps, {
        stderr_tail: result.stderr,
      });
      return {
        ok: false,
        error: errorEntry,
        action: {
          verb: action.verb,
          issueNumber: action.issueNumber,
          args: action.args,
          gh_argv: plannedCommands,
          executed_gh_argv: executedCommands,
          result: "error",
        },
      };
    }

    recordLog(context.logPath, action, "applied", [argv], context.deps);
    executedCommands.push(argv);
    if (!context.appliedCommandsByAction.has(actionKey)) {
      context.appliedCommandsByAction.set(actionKey, new Set());
    }
    context.appliedCommandsByAction.get(actionKey).add(stableSerialize(argv));
  }

  return {
    ok: true,
    action: {
      verb: action.verb,
      issueNumber: action.issueNumber,
      args: action.args,
      gh_argv: plannedCommands,
      executed_gh_argv: executedCommands,
      result: "applied",
    },
  };
}

function summarizeResults(actions, skipped) {
  const counts = new Map();

  for (const action of actions) {
    counts.set(action.result, (counts.get(action.result) || 0) + 1);
  }
  for (const entry of skipped) {
    counts.set(entry.result, (counts.get(entry.result) || 0) + 1);
  }

  return counts;
}

function renderText(result) {
  const lines = [];

  for (const action of result.actions) {
    if (action.result === "dry-run") {
      for (const argv of action.gh_argv) {
        lines.push(`DRY-RUN: ${formatGhCommand(argv)}`);
      }
      continue;
    }

    if (action.result === "applied") {
      for (const argv of action.executed_gh_argv || []) {
        lines.push(`APPLY: ${formatGhCommand(argv)}`);
      }
      continue;
    }

    if (action.result === "already-applied") {
      lines.push(`ALREADY-APPLIED: triage:${action.verb} #${action.issueNumber}`);
    }
  }

  for (const skipped of result.skipped) {
    const reason =
      skipped.result === "skipped-pending"
        ? "unchecked"
        : "unknown verb";
    lines.push(`SKIP: triage:${skipped.verb} #${skipped.issueNumber} (${reason})`);
  }

  const counts = summarizeResults(result.actions, result.skipped);
  lines.push(
    `Summary: ${[
      `dry-run=${counts.get("dry-run") || 0}`,
      `applied=${counts.get("applied") || 0}`,
      `already-applied=${counts.get("already-applied") || 0}`,
      `skipped-pending=${counts.get("skipped-pending") || 0}`,
      `skipped-unknown-verb=${counts.get("skipped-unknown-verb") || 0}`,
    ].join(", ")}`
  );

  return `${lines.join("\n")}\n`;
}

function execute(argv = process.argv.slice(2), deps = {}) {
  const options = parseArgs(argv);
  if (options.error) {
    return {
      exitCode: 1,
      error: options.error,
    };
  }

  const cwd = deps.cwd || process.cwd();
  const reportPath = path.resolve(cwd, options.reportPath);
  const now = deps.now || (() => new Date().toISOString());

  let reportText;
  try {
    reportText = (deps.readFile || fs.readFileSync)(reportPath, "utf-8");
  } catch (error) {
    return {
      exitCode: 1,
      error: `Failed to read report at ${reportPath}: ${error.message}`,
    };
  }

  let report;
  try {
    report = parseReport(reportText);
  } catch (error) {
    return {
      exitCode: 1,
      error: error.message,
    };
  }

  try {
    ensureApplyAllowed(options, {
      confirmApply: deps.confirmApply,
      stderr: deps.stderr,
      stdinIsTTY: deps.stdinIsTTY,
      stdoutIsTTY: deps.stdoutIsTTY,
      inputFd: deps.inputFd,
    });
  } catch (error) {
    return {
      exitCode: 1,
      error: error.message,
    };
  }

  const deduped = dedupActions(report.anchors);
  const applyMode = options.apply ? "apply" : "dry-run";
  const result = {
    report: reportPath,
    parsed: report.parsed,
    deduped: deduped.length,
    actions: [],
    skipped: [],
    apply_mode: applyMode,
  };

  let logPath;
  let appliedCommandsByAction = new Map();
  if (options.apply) {
    const reportDate = resolveReportDate(report.frontmatter, now());
    logPath = resolveLogPath(reportDate, cwd);

    try {
      const logState = readApplyLog(logPath, deps.readFile || fs.readFileSync);
      appliedCommandsByAction = logState.appliedCommandsByAction;
    } catch (error) {
      return {
        exitCode: 1,
        error: error.message,
      };
    }
  }

  const effectDeps = {
    now,
    runGh: deps.runGh || ((argvToRun) => runGh(argvToRun, { execFile: deps.execFile || execFileSync })),
    appendFile: deps.appendFile || fs.appendFileSync,
    mkdir: deps.mkdir || fs.mkdirSync,
  };

  for (const action of deduped) {
    if (!action.checked) {
      result.skipped.push({
        verb: action.verb,
        issueNumber: action.issueNumber,
        reason: "unchecked",
        result: "skipped-pending",
      });
      if (options.apply) {
        recordLog(logPath, action, "skipped-pending", toGhCommands(action), effectDeps);
      }
      continue;
    }

    if (!action.knownVerb) {
      result.skipped.push({
        verb: action.verb,
        issueNumber: action.issueNumber,
        reason: "unknown verb",
        result: "skipped-unknown-verb",
      });
      if (options.apply) {
        recordLog(logPath, action, "skipped-unknown-verb", [], effectDeps);
      }
      continue;
    }

    if (!options.apply) {
      result.actions.push({
        verb: action.verb,
        issueNumber: action.issueNumber,
        args: action.args,
        gh_argv: toGhCommands(action),
        result: "dry-run",
      });
      continue;
    }

    const applied = applyAcceptedAction(action, {
      logPath,
      appliedCommandsByAction,
      deps: effectDeps,
    });

    if (!applied.ok) {
      if (applied.action) {
        result.actions.push(applied.action);
      }
      result.error = [
        `Failed to apply triage:${action.verb} #${action.issueNumber}.`,
        applied.error?.stderr_tail || null,
      ].filter(Boolean).join(" ");
      return {
        ...result,
        exitCode: 1,
      };
    }

    result.actions.push(applied.action);
  }

  return {
    ...result,
    exitCode: 0,
  };
}

function main() {
  const wantsJson = process.argv.slice(2).includes("--json");
  const result = execute();
  if (result.error) {
    console.error(result.error);
  } else if (wantsJson) {
    console.log(JSON.stringify({
      report: result.report,
      parsed: result.parsed,
      deduped: result.deduped,
      actions: result.actions.map((action) => ({
        verb: action.verb,
        issueNumber: action.issueNumber,
        args: action.args,
        gh_argv: action.gh_argv,
        result: action.result,
      })),
      skipped: result.skipped,
      apply_mode: result.apply_mode,
    }, null, 2));
  } else {
    process.stdout.write(renderText(result));
  }

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

if (require.main === module) main();

module.exports = {
  ANCHOR_PATTERN,
  CHECKBOX_PATTERN,
  SUPPORTED_VERBS,
  UNKNOWN_PRIORITY_PLACEHOLDER,
  usage,
  parseArgs,
  normalizeArgs,
  stableSerialize,
  buildActionKey,
  parseFrontmatter,
  parseReport,
  dedupActions,
  formatRevisitComment,
  formatDuplicateComment,
  buildPriorityEditCommand,
  toGhCommands,
  formatGhCommand,
  trimStderr,
  runGh,
  parseGhLabels,
  extractCommandArrays,
  readApplyLog,
  appendLogLine,
  buildLogEntry,
  resolveReportDate,
  resolveLogPath,
  readLineSync,
  confirmApply,
  ensureApplyAllowed,
  applyAcceptedAction,
  summarizeResults,
  renderText,
  execute,
};
