#!/usr/bin/env node

/**
 * Idempotent setup: create `.dev-backlog/sprints/`, migrate a legacy `backlog/`
 * skill layout, nothing else (#446). GitHub Issues are the task authority by
 * default, or an optional `.dev-backlog/.tracker` value (read-only; #476).
 * `config.yml` is never read or written -- a leftover one keeps its bytes.
 */

const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_BACKLOG_DIR,
  LEGACY_EXPORT_DIR,
  leftoverSkillFiles,
  migrateLegacyExecutionRoot,
} = require("./execution-root.js");
const { readTaskAuthority } = require("./lib.js");

const MINIMUM_DIRECTORIES = Object.freeze(["sprints"]);
const TRACKER_FLAG_NOTICE = "--tracker is ignored since v0.12.0; the task authority is the .dev-backlog/.tracker line";

class SetupError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "SetupError";
    this.exitCode = options.exitCode || 1;
  }
}

function usage() {
  return [
    "Usage: setup-dev-backlog.js [--non-interactive] [--json] [--tracker <key>]",
    "Creates .dev-backlog/sprints/ and migrates a legacy backlog/ skill layout.",
    "--tracker is accepted and ignored; write .dev-backlog/.tracker by hand to choose the authority.",
  ].join("\n");
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { tracker: undefined, nonInteractive: false, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--tracker") {
      options.tracker = argv[(index += 1)];
      if (options.tracker === undefined || options.tracker.startsWith("--")) {
        throw new SetupError(`--tracker requires a value.\n${usage()}`);
      }
    } else if (arg.startsWith("--tracker=")) {
      options.tracker = arg.slice("--tracker=".length);
    } else if (arg === "--non-interactive") {
      options.nonInteractive = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new SetupError(`Unknown argument: ${arg}.\n${usage()}`);
    }
  }
  return options;
}

function lstatIfPresent(targetPath, fsApi) {
  try {
    return fsApi.lstatSync(targetPath);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

// Refuse a symlinked or irregular root, config.yml, or sprints/ before any mkdir.
function validateExistingStructure(backlogDir, fsApi) {
  const targets = [
    [backlogDir, "backlog", "real directory"],
    [path.join(backlogDir, "config.yml"), "config", "regular file"],
    ...MINIMUM_DIRECTORIES.map((name) => [path.join(backlogDir, name), "backlog", "real directory"]),
  ];
  for (const [target, label, kind] of targets) {
    const stat = lstatIfPresent(target, fsApi);
    if (!stat) continue;
    const kindOk = kind === "regular file" ? stat.isFile() : stat.isDirectory();
    if (stat.isSymbolicLink() || !kindOk) {
      throw new SetupError(`Refusing unsafe ${label} path: ${target} must be a ${kind}.`);
    }
  }
}

function ensureMinimumDirectories(backlogDir, fsApi) {
  const created = [];
  if (!lstatIfPresent(backlogDir, fsApi)) fsApi.mkdirSync(backlogDir);
  for (const name of MINIMUM_DIRECTORIES) {
    const directory = path.join(backlogDir, name);
    if (lstatIfPresent(directory, fsApi)) continue;
    fsApi.mkdirSync(directory);
    created.push(name);
  }
  return created;
}

async function runSetup(options = {}, dependencies = {}) {
  const fsApi = dependencies.fs || fs;
  const cwd = path.resolve(options.cwd || process.cwd());
  const backlogDir = path.join(cwd, DEFAULT_BACKLOG_DIR);

  if (!lstatIfPresent(backlogDir, fsApi) && leftoverSkillFiles(cwd, { fs: fsApi }).length > 0) {
    validateExistingStructure(path.join(cwd, LEGACY_EXPORT_DIR), fsApi);
    migrateLegacyExecutionRoot(cwd, { fs: fsApi });
  }
  validateExistingStructure(backlogDir, fsApi);
  readTaskAuthority(backlogDir);

  return Object.freeze({
    action: "setup-dev-backlog",
    createdDirectories: ensureMinimumDirectories(backlogDir, fsApi),
  });
}

function printHumanResult(result, backlogDir, output = process.stdout) {
  output.write(result.createdDirectories.length > 0
    ? `Created directories: ${result.createdDirectories.join(", ")}\n`
    : "Backlog directories already complete.\n");
  const source = fs.existsSync(path.join(backlogDir, ".tracker"))
    ? "(.dev-backlog/.tracker)"
    : "(default; .dev-backlog/.tracker not present)";
  output.write(`Task authority: ${readTaskAuthority(backlogDir)} ${source}\n`);
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  if (options.tracker !== undefined) process.stderr.write(`${TRACKER_FLAG_NOTICE}\n`);
  const result = await runSetup(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printHumanResult(result, path.join(process.cwd(), DEFAULT_BACKLOG_DIR));
  }
  return 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }, (error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`setup-dev-backlog: ${message}\n`);
    process.exitCode = error && Number.isInteger(error.exitCode) ? error.exitCode : 1;
  });
}

module.exports = { MINIMUM_DIRECTORIES, TRACKER_FLAG_NOTICE, SetupError, main, parseArgs, runSetup };
