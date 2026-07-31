#!/usr/bin/env node

/**
 * Idempotent, tracker-aware dev-backlog setup.
 *
 * Tracker authority lives in backlog/.tracker. backlog/config.yml is read only
 * as a legacy selection fallback and is never written by this script.
 */

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { readLegacyTracker: readLegacyTrackerFile } = require("./legacy-tracker.js");

const ALLOWED_TRACKERS = Object.freeze(["github", "local"]);
const MINIMUM_DIRECTORIES = Object.freeze(["sprints"]);
const LOCAL_COMPATIBILITY_DIRECTORIES = Object.freeze(["tasks", "completed"]);

function requiredDirectories(selection) {
  return selection === "local"
    ? [...MINIMUM_DIRECTORIES, ...LOCAL_COMPATIBILITY_DIRECTORIES]
    : [...MINIMUM_DIRECTORIES];
}

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

function usage() {
  return [
    "Usage: setup-dev-backlog.js [project-name] [options]",
    "",
    "Options:",
    "  --tracker github|local  Select the canonical task tracker",
    "  --non-interactive       Never prompt (required with --tracker when fresh)",
    "  --project-name NAME     Project name reported for compatibility",
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

function assertAllowedTracker(selection, sourcePath) {
  if (!ALLOWED_TRACKERS.includes(selection)) {
    throw new SetupError(
      `Invalid tracker selection ${JSON.stringify(selection)} in ${sourcePath}; expected github or local.`
    );
  }
  return selection;
}

function readTrackerFile(trackerPath, fsApi = fs) {
  return assertAllowedTracker(fsApi.readFileSync(trackerPath, "utf8").trim(), trackerPath);
}

// Legacy `config.yml` selection reading lives in `legacy-tracker.js`: it is a
// deletable unit that goes away wholesale when legacy support is dropped.
function readLegacyTracker(configPath, fsApi = fs) {
  return readLegacyTrackerFile(configPath, {
    fs: fsApi,
    assertAllowed: assertAllowedTracker,
    SetupError,
  });
}

function isGithubRemote(remote) {
  const value = String(remote || "").trim();
  if (!value) return false;
  const component = "[A-Za-z0-9_.-]+";
  const scp = value.match(/^git@([^:]+):(.+)$/);
  if (scp && scp[1].toLowerCase() === "github.com") {
    const parts = scp[2].split("/");
    const repo = (parts[1] || "").replace(/\.git$/, "");
    return parts.length === 2 &&
      new RegExp(`^${component}$`).test(parts[0]) &&
      new RegExp(`^${component}$`).test(repo) &&
      ![".", ".."].includes(parts[0]) &&
      ![".", ".."].includes(repo);
  }
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const standardHttps = parsed.protocol === "https:" && host === "github.com" &&
      parsed.port === "" && parsed.username === "" && parsed.password === "";
    const standardSsh = parsed.protocol === "ssh:" && host === "github.com" &&
      (parsed.port === "" || parsed.port === "22") && parsed.username === "git" && parsed.password === "";
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

function tempPathFor(targetPath) {
  const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.${nonce}.tmp`);
}

function atomicPublish(targetPath, content, { fs: fsApi = fs } = {}) {
  const targetStat = lstatIfPresent(targetPath, fsApi);
  if (targetStat && (targetStat.isSymbolicLink() || !targetStat.isFile())) {
    throw new SetupError(`Refusing unsafe tracker path: ${targetPath} must be a regular file.`);
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

function ensureMinimumDirectories(backlogDir, fsApi, selection) {
  const structure = { backlogCreated: false, created: [] };
  try {
    if (!lstatIfPresent(backlogDir, fsApi)) {
      fsApi.mkdirSync(backlogDir);
      structure.backlogCreated = true;
    }
    for (const name of requiredDirectories(selection)) {
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

function validateRegularFile(targetPath, label, fsApi) {
  const stat = lstatIfPresent(targetPath, fsApi);
  if (stat && (stat.isSymbolicLink() || !stat.isFile())) {
    throw new SetupError(`Refusing unsafe ${label} path: ${targetPath} must be a regular file.`);
  }
  return Boolean(stat);
}

function validateExistingStructure(backlogDir, configPath, trackerPath, fsApi) {
  const backlogStat = lstatIfPresent(backlogDir, fsApi);
  if (backlogStat && (backlogStat.isSymbolicLink() || !backlogStat.isDirectory())) {
    throw new SetupError(`Refusing unsafe backlog path: ${backlogDir} must be a real directory.`);
  }
  const configExists = validateRegularFile(configPath, "config", fsApi);
  const trackerExists = validateRegularFile(trackerPath, "tracker", fsApi);
  // Validate every recognized compatibility directory even when the selected
  // tracker would not create it. Existing legacy paths must not bypass the
  // same symlink/non-directory safety boundary during a GitHub setup.
  for (const name of requiredDirectories("local")) {
    const directory = path.join(backlogDir, name);
    const stat = lstatIfPresent(directory, fsApi);
    if (!stat) continue;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new SetupError(`Refusing unsafe backlog path: ${directory} must be a real directory.`);
    }
  }
  return { configExists, trackerExists };
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

async function chooseFreshTracker(options, dependencies, cwd) {
  if (options.tracker !== undefined) {
    return { selection: options.tracker, selectionSource: "explicit" };
  }
  const interactive = !options.nonInteractive && (
    dependencies.isInteractive !== undefined
      ? dependencies.isInteractive
      : Boolean(process.stdin.isTTY && process.stdout.isTTY)
  );
  if (!interactive) throw new SetupError(refusalMessage());

  const evidence = collectGithubEvidence({
    cwd,
    execFileSync: dependencies.execFileSync || childProcess.execFileSync,
  });
  if (typeof dependencies.prompt !== "function") {
    throw new SetupError("Interactive setup requires a prompt boundary.");
  }
  const answer = String(await dependencies.prompt({
    recommendation: evidence.recommendation,
    evidence,
  }) || "").trim().toLowerCase();
  const selection = answer || evidence.recommendation;
  assertAllowedTracker(selection, "interactive choice");
  return {
    selection,
    selectionSource: selection === evidence.recommendation
      ? "recommended"
      : "interactive-choice",
    evidence,
  };
}

async function runSetup(options = {}, dependencies = {}) {
  const fsApi = dependencies.fs || fs;
  const cwd = path.resolve(options.cwd || process.cwd());
  const backlogDir = path.join(cwd, "backlog");
  const configPath = path.join(backlogDir, "config.yml");
  const trackerPath = path.join(backlogDir, ".tracker");
  const state = validateExistingStructure(backlogDir, configPath, trackerPath, fsApi);

  if (options.tracker !== undefined) {
    assertAllowedTracker(options.tracker, "--tracker");
  }

  let selection;
  let selectionSource;
  let recommendationEvidence;
  if (state.trackerExists) {
    const current = readTrackerFile(trackerPath, fsApi);
    selection = options.tracker ?? current;
    selectionSource = options.tracker === undefined ? "preserved" : "explicit";
  } else if (state.configExists) {
    const legacy = readLegacyTracker(configPath, fsApi);
    if (!legacy.found && options.tracker === "local") {
      throw new SetupError(legacyLocalRefusalMessage());
    }
    selection = options.tracker ?? legacy.selection ?? "github";
    selectionSource = options.tracker !== undefined
      ? "explicit"
      : legacy.found ? "legacy-migration" : "legacy-pin";
  } else {
    const fresh = await chooseFreshTracker(options, dependencies, cwd);
    selection = fresh.selection;
    selectionSource = fresh.selectionSource;
    recommendationEvidence = fresh.evidence;
  }

  const structure = ensureMinimumDirectories(backlogDir, fsApi, selection);
  let publication;
  try {
    publication = atomicPublish(trackerPath, `${selection}\n`, { fs: fsApi });
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
    projectName: options.projectName || defaultProjectName(cwd),
    selection,
    selectionSource,
    trackerPath,
    trackerChanged: publication.changed,
    trackerCreated: publication.created,
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
  output.write(
    `${result.trackerCreated ? "Created" : result.trackerChanged ? "Updated" : "Preserved"}: ` +
    `${result.trackerPath}\n`
  );
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
  LOCAL_COMPATIBILITY_DIRECTORIES,
  MINIMUM_DIRECTORIES,
  SetupError,
  atomicPublish,
  checkGithubAvailability,
  collectGithubEvidence,
  githubAvailabilityFromEvidence,
  isGithubRemote,
  main,
  parseArgs,
  printHumanResult,
  readLegacyTracker,
  readTrackerFile,
  requiredDirectories,
  runSetup,
};
