#!/usr/bin/env node

/**
 * Idempotent, tracker-aware dev-backlog setup.
 *
 * The config file is treated as text. Setup validates and edits only one
 * top-level tracker scalar; it never parses and reserializes user YAML.
 */

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");

const ALLOWED_TRACKERS = Object.freeze(["github", "local"]);
const MINIMUM_DIRECTORIES = Object.freeze(["sprints", "tasks", "completed"]);

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) return text;
  return `'${text.replaceAll("'", `'"'"'`)}'`;
}

function setupCommand(args = []) {
  return [shellQuote(process.execPath), shellQuote(__filename), ...args.map(shellQuote)].join(" ");
}

class SetupError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "SetupError";
    this.exitCode = options.exitCode || 1;
  }
}

class ConfigValidationError extends SetupError {
  constructor(configPath, reason) {
    super(
      `Invalid tracker configuration in ${configPath}: ${reason}. ` +
        `Expected exactly one top-level "tracker: github" or "tracker: local" line. ` +
        `Repair the file, then rerun: ${setupCommand(["--tracker", "github", "--non-interactive"])}.`
    );
    this.name = "ConfigValidationError";
    this.configPath = configPath;
  }
}

function usage() {
  return [
    "Usage: setup-dev-backlog.js [project-name] [options]",
    "",
    "Options:",
    "  --tracker github|local  Select the canonical task tracker",
    "  --non-interactive       Never prompt (required with --tracker when fresh)",
    "  --project-name NAME     Project name for a fresh config",
    "  --json                  Print structured output",
    "  --help                  Show this help",
  ].join("\n");
}

function takeValue(argv, index, flag) {
  if (index + 1 >= argv.length || argv[index + 1].startsWith("--")) {
    throw new SetupError(`${flag} requires a value.\n${usage()}`);
  }
  return argv[index + 1];
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    tracker: undefined,
    nonInteractive: false,
    json: false,
    projectName: undefined,
    help: false,
  };
  let positionalProjectName;
  let trackerFlagSeen = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--tracker") {
      if (trackerFlagSeen) throw new SetupError("--tracker may be supplied only once.");
      trackerFlagSeen = true;
      options.tracker = takeValue(argv, index, "--tracker");
      index += 1;
    } else if (arg.startsWith("--tracker=")) {
      if (trackerFlagSeen) throw new SetupError("--tracker may be supplied only once.");
      trackerFlagSeen = true;
      options.tracker = arg.slice("--tracker=".length);
    } else if (arg === "--project-name") {
      options.projectName = takeValue(argv, index, "--project-name");
      index += 1;
    } else if (arg.startsWith("--project-name=")) {
      options.projectName = arg.slice("--project-name=".length);
    } else if (arg === "--non-interactive") {
      options.nonInteractive = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("-")) {
      throw new SetupError(`Unknown option: ${arg}.\n${usage()}`);
    } else if (positionalProjectName === undefined) {
      positionalProjectName = arg;
    } else {
      throw new SetupError(`Unexpected argument: ${arg}.\n${usage()}`);
    }
  }

  if (options.projectName !== undefined && positionalProjectName !== undefined) {
    throw new SetupError("Project name may be supplied either positionally or with --project-name, not both.");
  }
  options.projectName = options.projectName ?? positionalProjectName;

  if (options.tracker !== undefined && !ALLOWED_TRACKERS.includes(options.tracker)) {
    throw new SetupError(
      `Invalid --tracker value ${JSON.stringify(options.tracker)}; expected github or local.`
    );
  }
  if (options.projectName !== undefined && options.projectName.length === 0) {
    throw new SetupError("--project-name requires a non-empty value.");
  }
  return options;
}

function lineRecords(raw) {
  const records = [];
  const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/g;
  let match;
  while ((match = pattern.exec(raw)) !== null) {
    if (match[0] === "" && match.index === raw.length) break;
    records.push({
      text: match[1],
      newline: match[2],
      start: match.index,
      end: match.index + match[1].length,
    });
    if (match[2] === "") break;
  }
  return records;
}

function consumeQuotedToken(line, start, quote) {
  let raw = "";
  for (let index = start + 1; index < line.length; index += 1) {
    if (quote === "'" && line[index] === "'" && line[index + 1] === "'") {
      raw += "''";
      index += 1;
    } else if (quote === '"' && line[index] === "\\" && index + 1 < line.length) {
      raw += line.slice(index, index + 2);
      index += 1;
    } else if (line[index] === quote) {
      return { closed: true, end: index + 1, raw };
    } else {
      raw += line[index];
    }
  }
  return { closed: false, end: line.length, raw };
}

function decodeDoubleQuotedScalar(raw) {
  const simpleEscapes = Object.freeze({
    "0": "\0", a: "\x07", b: "\b", t: "\t", n: "\n", v: "\v", f: "\f",
    r: "\r", e: "\x1b", " ": " ", '"': '"', "/": "/", "\\": "\\",
  });
  let decoded = "";
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== "\\") {
      decoded += raw[index];
      continue;
    }
    const escape = raw[index + 1];
    if (Object.hasOwn(simpleEscapes, escape)) {
      decoded += simpleEscapes[escape];
      index += 1;
      continue;
    }
    const width = escape === "x" ? 2 : escape === "u" ? 4 : escape === "U" ? 8 : 0;
    const digits = raw.slice(index + 2, index + 2 + width);
    if (!width || digits.length !== width || !/^[0-9A-Fa-f]+$/.test(digits)) return null;
    const codePoint = Number.parseInt(digits, 16);
    if (codePoint > 0x10ffff) return null;
    decoded += String.fromCodePoint(codePoint);
    index += width + 1;
  }
  return decoded;
}

function isColonIndicator(line, index) {
  const next = line[index + 1];
  return next === undefined || /[ \t\r\n,\[\]{}]/.test(next);
}

function tokenizeYamlLine(line, state = {}) {
  const tokens = [];
  let index = 0;
  let carriedQuote = state.quote || null;
  let flowDepth = state.flowDepth || 0;
  let nodeBoundary = flowDepth > 0 ? Boolean(state.nodeBoundary) : true;

  if (carriedQuote) {
    const continuation = consumeQuotedToken(line, -1, carriedQuote);
    if (!continuation.closed) {
      return { tokens, state: { quote: carriedQuote, flowDepth, nodeBoundary: false } };
    }
    index = continuation.end;
    carriedQuote = null;
    nodeBoundary = false;
  }

  while (index < line.length) {
    if (/[ \t\uFEFF]/.test(line[index])) {
      index += 1;
      continue;
    }
    if (line[index] === "#") break;

    const char = line[index];
    if (nodeBoundary && (char === "'" || char === '"')) {
      const quoted = consumeQuotedToken(line, index, char);
      if (!quoted.closed) {
        return { tokens, state: { quote: char, flowDepth, nodeBoundary: false } };
      }
      const value = char === "'"
        ? quoted.raw.replaceAll("''", "'")
        : decodeDoubleQuotedScalar(quoted.raw);
      tokens.push({ type: "scalar", value, quoted: true });
      index = quoted.end;
      nodeBoundary = false;
      continue;
    }

    if (nodeBoundary && (char === "&" || char === "!")) {
      const start = index;
      if (char === "!" && line[index + 1] === "<") {
        const close = line.indexOf(">", index + 2);
        index = close === -1 ? line.length : close + 1;
      } else {
        while (index < line.length && !/[ \t,\[\]{}]/.test(line[index])) index += 1;
      }
      tokens.push({ type: "property", value: line.slice(start, index) });
      continue;
    }

    if (char === "{" || char === "[") {
      tokens.push({ type: char });
      flowDepth += 1;
      nodeBoundary = true;
      index += 1;
      continue;
    }
    if (char === "}" || char === "]") {
      tokens.push({ type: char });
      flowDepth = Math.max(0, flowDepth - 1);
      nodeBoundary = false;
      index += 1;
      continue;
    }
    if (flowDepth > 0 && char === ",") {
      tokens.push({ type: "," });
      nodeBoundary = true;
      index += 1;
      continue;
    }
    if (char === ":" && isColonIndicator(line, index)) {
      tokens.push({ type: ":" });
      nodeBoundary = true;
      index += 1;
      continue;
    }
    if (nodeBoundary && char === "?" && /[ \t]/.test(line[index + 1] || "")) {
      tokens.push({ type: "?" });
      index += 1;
      continue;
    }
    if (nodeBoundary && char === "-" && (line[index + 1] === undefined || /[ \t]/.test(line[index + 1]))) {
      tokens.push({ type: "-" });
      index += 1;
      continue;
    }

    const start = index;
    while (index < line.length) {
      const current = line[index];
      if (current === "#" || current === "{" || current === "[" || current === "}" || current === "]") break;
      if (flowDepth > 0 && current === ",") break;
      if (current === ":" && isColonIndicator(line, index)) break;
      index += 1;
    }
    const value = line.slice(start, index).trim();
    if (value) tokens.push({ type: "scalar", value, quoted: false });
    nodeBoundary = false;
    if (index === start) index += 1;
  }

  return { tokens, state: { quote: null, flowDepth, nodeBoundary } };
}

function trackerKeyCount(tokens) {
  let count = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index].type !== "scalar" || tokens[index].value !== "tracker") continue;
    const next = tokens[index + 1];
    const previous = tokens[index - 1];
    if ((next && next.type === ":") || (previous && previous.type === "?")) count += 1;
  }
  return count;
}

function isBlockScalarHeader(tokens) {
  const last = tokens[tokens.length - 1];
  if (!last || last.type !== "scalar" || !/^[>|](?:[1-9][+-]?|[+-][1-9]?)?$/.test(last.value)) {
    return false;
  }
  return tokens.some((token) => token.type === ":");
}

function trackerCandidates(raw) {
  const candidates = [];
  let blockScalarParentIndent = null;
  let lexicalState = { quote: null, flowDepth: 0, nodeBoundary: true };

  for (const record of lineRecords(raw)) {
    const withoutBom = record.text.replace(/^\uFEFF/, "");
    const trimmed = withoutBom.trim();
    const indent = withoutBom.match(/^[ \t]*/)[0].length;
    if (blockScalarParentIndent !== null) {
      if (!trimmed || indent > blockScalarParentIndent) continue;
      blockScalarParentIndent = null;
    }
    const scanned = tokenizeYamlLine(record.text, lexicalState);
    lexicalState = scanned.state;
    for (let count = trackerKeyCount(scanned.tokens); count > 0; count -= 1) candidates.push(record);
    if (!lexicalState.quote && lexicalState.flowDepth === 0 && isBlockScalarHeader(scanned.tokens)) {
      blockScalarParentIndent = indent;
    }
  }
  return candidates;
}

function parseValidTrackerLine(record) {
  const match = record.text.match(
    /^\uFEFF?tracker:([ \t]*)(?:(["'])(github|local)\2|(github|local))([ \t]*(?:#.*)?)$/
  );
  if (!match) return null;

  const tracker = match[3] || match[4];
  const colon = record.text.indexOf(":");
  const quoteLength = match[2] ? 1 : 0;
  const scalarStart = record.start + colon + 1 + match[1].length + quoteLength;
  return {
    tracker,
    scalarStart,
    scalarEnd: scalarStart + tracker.length,
    lineStart: record.start,
    lineEnd: record.end,
  };
}

function inspectConfig(raw, configPath = "backlog/config.yml") {
  if (typeof raw !== "string") {
    throw new ConfigValidationError(configPath, "the config could not be read as text");
  }

  const candidates = trackerCandidates(raw);
  if (candidates.length === 0) {
    return Object.freeze({ kind: "legacy", tracker: undefined });
  }
  if (candidates.length > 1) {
    throw new ConfigValidationError(configPath, "duplicate or ambiguous tracker declarations were found");
  }

  const parsed = parseValidTrackerLine(candidates[0]);
  if (!parsed) {
    const nested = /^\s+/.test(candidates[0].text) || /^\s*-/.test(candidates[0].text);
    throw new ConfigValidationError(
      configPath,
      nested
        ? "tracker must be a single top-level scalar, not nested"
        : "the tracker value is missing, malformed, quoted as a key, or unsupported"
    );
  }
  return Object.freeze({ kind: "selected", ...parsed });
}

function detectNewline(raw) {
  const match = raw.match(/\r\n|\n|\r/);
  return match ? match[0] : "\n";
}

function mutateTrackerText(raw, state, selection) {
  if (!ALLOWED_TRACKERS.includes(selection)) {
    throw new SetupError(`Invalid tracker selection ${JSON.stringify(selection)}.`);
  }
  if (state.kind === "selected") {
    if (state.tracker === selection) return raw;
    return raw.slice(0, state.scalarStart) + selection + raw.slice(state.scalarEnd);
  }
  if (state.kind !== "legacy") {
    throw new SetupError("Cannot mutate an unvalidated tracker config state.");
  }

  const newline = detectNewline(raw);
  if (raw.length === 0) return `tracker: ${selection}${newline}`;
  const hasFinalNewline = /(?:\r\n|\n|\r)$/.test(raw);
  return hasFinalNewline
    ? `${raw}tracker: ${selection}${newline}`
    : `${raw}${newline}tracker: ${selection}`;
}

function isGithubRemote(remote) {
  const value = String(remote || "").trim();
  if (!value) return false;
  const component = "[A-Za-z0-9_.-]+";
  if (new RegExp(`^git@github\\.com:${component}/${component}(?:\\.git)?$`).test(value)) {
    return true;
  }
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const standardHttps = parsed.protocol === "https:" && host === "github.com" &&
      parsed.port === "" && parsed.username === "" && parsed.password === "";
    const standardSsh = parsed.protocol === "ssh:" && host === "github.com" &&
      parsed.port === "" && parsed.username === "git" && parsed.password === "";
    const sshOver443 = parsed.protocol === "ssh:" && host === "ssh.github.com" &&
      parsed.port === "443" && parsed.username === "git" && parsed.password === "";
    return (
      (standardHttps || standardSsh || sshOver443) &&
      parsed.search === "" &&
      parsed.hash === "" &&
      new RegExp(`^/${component}/${component}(?:\\.git)?$`).test(parsed.pathname)
    );
  } catch {
    return false;
  }
}

function commandFailedBecauseMissing(error) {
  return error && (error.code === "ENOENT" || error.errno === -2);
}

function collectGithubEvidence({
  cwd = process.cwd(),
  execFileSync = childProcess.execFileSync,
} = {}) {
  let remote = "missing";
  try {
    const rawRemote = execFileSync(
      "git",
      ["config", "--get", "remote.origin.url"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    remote = isGithubRemote(rawRemote) ? "github" : "non-github";
  } catch {
    remote = "missing";
  }

  let cli = "available";
  let auth = "authenticated";
  try {
    execFileSync(
      "gh",
      ["auth", "status", "--hostname", "github.com"],
      { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (error) {
    if (commandFailedBecauseMissing(error)) {
      cli = "missing";
      auth = "not-checked";
    } else {
      cli = "available";
      auth = "unauthenticated";
    }
  }

  const recommendation = remote === "github" && auth === "authenticated"
    ? "github"
    : "local";
  return Object.freeze({ recommendation, remote, cli, auth });
}

function githubAvailabilityFromEvidence(evidence) {
  const problems = [];
  const repairs = [];
  if (evidence.remote !== "github") {
    problems.push(evidence.remote === "missing" ? "GitHub origin not found" : "origin is not GitHub");
    repairs.push(
      evidence.remote === "missing"
        ? "git remote add origin <github-url>"
        : "git remote set-url origin <github-url>"
    );
  }
  if (evidence.cli === "missing") {
    problems.push("gh CLI not found");
    repairs.push("install GitHub CLI from https://cli.github.com/ and run gh auth login --hostname github.com");
  } else if (evidence.auth !== "authenticated") {
    problems.push("gh is not authenticated for github.com");
    repairs.push("gh auth login --hostname github.com");
  }

  if (problems.length === 0) {
    return Object.freeze({ available: true, evidence });
  }
  return Object.freeze({
    available: false,
    evidence,
    reason: problems.join("; "),
    repair: repairs.join("; "),
    fallbackAttempted: false,
  });
}

function checkGithubAvailability(options) {
  return githubAvailabilityFromEvidence(collectGithubEvidence(options));
}

function freshConfig(projectName, tracker) {
  return [
    `project_name: ${JSON.stringify(projectName)}`,
    `tracker: ${tracker}`,
    'task_prefix: "BACK"',
    'default_status: "To Do"',
    'statuses: ["To Do", "In Progress", "Done"]',
    "",
  ].join("\n");
}

function tempPathFor(targetPath) {
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${nonce}.tmp`);
}

function atomicPublish(targetPath, content, { fs: fsApi = fs } = {}) {
  const targetStat = lstatIfPresent(targetPath, fsApi);
  if (targetStat && (targetStat.isSymbolicLink() || !targetStat.isFile())) {
    throw new SetupError(`Refusing unsafe config path: ${targetPath} must be a regular file.`);
  }
  const targetExists = Boolean(targetStat);
  if (targetExists) {
    const current = fsApi.readFileSync(targetPath, "utf8");
    if (current === content) return Object.freeze({ changed: false, created: false });
  }

  const tempPath = tempPathFor(targetPath);
  try {
    fsApi.writeFileSync(tempPath, content, { encoding: "utf8", flag: "wx" });
    if (targetExists && typeof fsApi.chmodSync === "function") {
      fsApi.chmodSync(tempPath, fsApi.statSync(targetPath).mode);
    }
    fsApi.renameSync(tempPath, targetPath);
  } catch (error) {
    try {
      if (fsApi.existsSync(tempPath)) fsApi.unlinkSync(tempPath);
    } catch {
      // Preserve the publication error. A best-effort cleanup was attempted.
    }
    throw error;
  }
  return Object.freeze({ changed: true, created: !targetExists });
}

function ensureMinimumDirectories(backlogDir, fsApi) {
  const structure = { backlogCreated: false, created: [] };
  try {
    if (!lstatIfPresent(backlogDir, fsApi)) {
      fsApi.mkdirSync(backlogDir);
      structure.backlogCreated = true;
    }
    for (const name of MINIMUM_DIRECTORIES) {
      const directory = path.join(backlogDir, name);
      if (!lstatIfPresent(directory, fsApi)) {
        fsApi.mkdirSync(directory);
        structure.created.push(name);
      }
    }
    return structure;
  } catch (error) {
    rollbackCreatedDirectories(backlogDir, structure, fsApi);
    throw error;
  }
}

function lstatIfPresent(targetPath, fsApi) {
  try {
    return fsApi.lstatSync(targetPath);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

function validateExistingStructure(backlogDir, configPath, fsApi) {
  const backlogStat = lstatIfPresent(backlogDir, fsApi);
  if (backlogStat) {
    if (backlogStat.isSymbolicLink() || !backlogStat.isDirectory()) {
      throw new SetupError(`Refusing unsafe backlog path: ${backlogDir} must be a real directory.`);
    }
  }
  const configStat = lstatIfPresent(configPath, fsApi);
  if (configStat) {
    if (configStat.isSymbolicLink() || !configStat.isFile()) {
      throw new SetupError(`Refusing unsafe config path: ${configPath} must be a regular file.`);
    }
  }
  for (const name of MINIMUM_DIRECTORIES) {
    const directory = path.join(backlogDir, name);
    const stat = lstatIfPresent(directory, fsApi);
    if (!stat) continue;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new SetupError(`Refusing unsafe backlog path: ${directory} must be a real directory.`);
    }
  }
  return { configExists: Boolean(configStat) };
}

function rollbackCreatedDirectories(backlogDir, structure, fsApi) {
  for (const name of [...structure.created].reverse()) {
    try {
      fsApi.rmdirSync(path.join(backlogDir, name));
    } catch {
      // A concurrent writer made it non-empty or removed it; never delete content.
    }
  }
  if (structure.backlogCreated) {
    try {
      fsApi.rmdirSync(backlogDir);
    } catch {
      // Preserve anything that appeared concurrently.
    }
  }
}

function defaultProjectName(cwd) {
  return path.basename(path.resolve(cwd)) || "project";
}

function refusalMessage() {
  return (
    "Fresh non-interactive setup requires an explicit tracker. " +
    `Recommended safe rerun: ${setupCommand(["--tracker", "local", "--non-interactive"])}`
  );
}

function legacyLocalRefusalMessage() {
  const pin = setupCommand(["--non-interactive"]);
  const switchTracker = setupCommand(["--tracker", "local", "--non-interactive"]);
  return (
    "Existing tracker-less config has legacy GitHub authority and cannot switch directly to local. " +
    `First pin compatibility with ${pin}; then explicitly switch with ${switchTracker}. ` +
    "This setup does not migrate task files."
  );
}

async function runSetup(options = {}, dependencies = {}) {
  const fsApi = dependencies.fs || fs;
  const cwd = path.resolve(options.cwd || process.cwd());
  const backlogDir = path.join(cwd, "backlog");
  const configPath = path.join(backlogDir, "config.yml");
  const structureState = validateExistingStructure(backlogDir, configPath, fsApi);
  const configExists = structureState.configExists;
  let raw;
  let configState;

  // The entire tracker situation is read and validated before mkdir or temp creation.
  if (configExists) {
    raw = fsApi.readFileSync(configPath, "utf8");
    configState = inspectConfig(raw, configPath);
  }

  if (options.tracker !== undefined && !ALLOWED_TRACKERS.includes(options.tracker)) {
    throw new SetupError(`Invalid tracker selection ${JSON.stringify(options.tracker)}; expected github or local.`);
  }

  let selection;
  let selectionSource;
  let recommendationEvidence;
  if (configState && configState.kind === "legacy" && options.tracker === "local") {
    throw new SetupError(legacyLocalRefusalMessage());
  }
  if (configState && configState.kind === "legacy") {
    selection = "github";
    selectionSource = "legacy-pin";
  } else if (options.tracker !== undefined) {
    selection = options.tracker;
    selectionSource = "explicit";
  } else if (configState && configState.kind === "selected") {
    selection = configState.tracker;
    selectionSource = "preserved";
  } else {
    const interactive = !options.nonInteractive && (
      dependencies.isInteractive !== undefined
        ? dependencies.isInteractive
        : Boolean(process.stdin.isTTY && process.stdout.isTTY)
    );
    if (!interactive) throw new SetupError(refusalMessage());

    recommendationEvidence = collectGithubEvidence({
      cwd,
      execFileSync: dependencies.execFileSync || childProcess.execFileSync,
    });
    if (typeof dependencies.prompt !== "function") {
      throw new SetupError("Interactive setup requires a prompt boundary.");
    }
    const answer = String(await dependencies.prompt({
      recommendation: recommendationEvidence.recommendation,
      evidence: recommendationEvidence,
    }) || "").trim().toLowerCase();
    selection = answer || recommendationEvidence.recommendation;
    if (!ALLOWED_TRACKERS.includes(selection)) {
      throw new SetupError(`Invalid tracker choice ${JSON.stringify(answer)}; enter github or local.`);
    }
    selectionSource = selection === recommendationEvidence.recommendation
      ? "recommended"
      : "interactive-choice";
  }

  const projectName = options.projectName || defaultProjectName(cwd);
  const nextRaw = configExists
    ? mutateTrackerText(raw, configState, selection)
    : freshConfig(projectName, selection);

  const structure = ensureMinimumDirectories(backlogDir, fsApi);
  let publication;
  try {
    publication = atomicPublish(configPath, nextRaw, { fs: fsApi });
  } catch (error) {
    rollbackCreatedDirectories(backlogDir, structure, fsApi);
    throw error;
  }

  let github;
  if (selection === "github") {
    if (recommendationEvidence) {
      github = githubAvailabilityFromEvidence(recommendationEvidence);
    } else {
      github = Object.freeze({
        available: undefined,
        checked: false,
        fallbackAttempted: false,
        repair: "verify with gh auth status --hostname github.com; repair with gh auth login --hostname github.com",
      });
    }
  }

  return Object.freeze({
    action: "setup-dev-backlog",
    projectName,
    selection,
    selectionSource,
    configPath,
    configChanged: publication.changed,
    configCreated: publication.created,
    createdDirectories: structure.created,
    evidence: recommendationEvidence,
    github,
  });
}

function evidenceSummary(evidence) {
  return `origin=${evidence.remote}, gh=${evidence.cli}, auth=${evidence.auth}`;
}

function printHumanResult(result, output = process.stdout) {
  output.write(`Tracker: ${result.selection} (${result.selectionSource})\n`);
  output.write(`${result.configCreated ? "Created" : result.configChanged ? "Updated" : "Preserved"}: ${result.configPath}\n`);
  if (result.createdDirectories.length > 0) {
    output.write(`Created directories: ${result.createdDirectories.join(", ")}\n`);
  } else {
    output.write("Backlog directories already complete.\n");
  }
  if (result.evidence) {
    output.write(`Recommendation evidence: ${evidenceSummary(result.evidence)}\n`);
  }
  if (result.github && result.github.available === false) {
    output.write(`GitHub tracker remains selected but is unavailable: ${result.github.reason}.\n`);
    output.write(`Repair: ${result.github.repair}. No local fallback was attempted.\n`);
  } else if (result.github && result.github.checked === false) {
    output.write(`GitHub tracker remains selected without provider probing. If unavailable, ${result.github.repair}.\n`);
  }
}

async function promptForTracker({ recommendation, evidence }) {
  process.stdout.write(
    `Recommended tracker: ${recommendation} (${evidenceSummary(evidence)}).\n`
  );
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await terminal.question(
      `Tracker [github/local] (default: ${recommendation}): `
    );
  } finally {
    terminal.close();
  }
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const result = await runSetup(options, { prompt: promptForTracker });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printHumanResult(result);
  }
  return 0;
}

if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`setup-dev-backlog: ${message}\n`);
      process.exitCode = error && Number.isInteger(error.exitCode) ? error.exitCode : 1;
    }
  );
}

module.exports = {
  ALLOWED_TRACKERS,
  MINIMUM_DIRECTORIES,
  ConfigValidationError,
  SetupError,
  atomicPublish,
  checkGithubAvailability,
  collectGithubEvidence,
  freshConfig,
  githubAvailabilityFromEvidence,
  inspectConfig,
  isGithubRemote,
  main,
  mutateTrackerText,
  parseArgs,
  printHumanResult,
  runSetup,
};
