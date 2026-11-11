#!/usr/bin/env node

/**
 * Bounded compatibility command: explicitly migrate the declared legacy
 * `backlog/` skill layout into `.dev-backlog/`, once. Fresh sprint creation is
 * owned by sprint-init.js. This command never reads or writes `.tracker`.
 */

const fs = require("node:fs");
const path = require("node:path");
const {
  migrateLegacyExecutionRoot,
} = require("./execution-root.js");

class SetupError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "SetupError";
    this.exitCode = options.exitCode || 1;
  }
}

function usage() {
  return [
    "Usage: setup-dev-backlog.js --migrate-legacy [--json]",
    "Explicitly migrates a legacy backlog/ skill layout into .dev-backlog/ once.",
    "Fresh repositories use sprint-init.js; task authority selection stays in .dev-backlog/.tracker.",
  ].join("\n");
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { migrateLegacy: false, json: false, help: false };
  for (const arg of argv) {
    if (arg === "--tracker" || arg.startsWith("--tracker=")) {
      throw new SetupError(
        `Removed argument: --tracker. Write .dev-backlog/.tracker by hand; migration does not read it.\n${usage()}`,
      );
    } else if (arg === "--non-interactive" || arg.startsWith("--non-interactive=")) {
      throw new SetupError(
        `Removed argument: --non-interactive. Authorize the one-time operation with --migrate-legacy.\n${usage()}`,
      );
    } else if (arg === "--migrate-legacy") {
      options.migrateLegacy = true;
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

async function runSetup(options = {}, dependencies = {}) {
  const fsApi = dependencies.fs || fs;
  if (options.migrateLegacy !== true) {
    throw new SetupError(`Refusing migration without --migrate-legacy.\n${usage()}`);
  }
  const cwd = path.resolve(options.cwd || process.cwd());
  try {
    return Object.freeze({
      action: "migrate-legacy-layout",
      ...migrateLegacyExecutionRoot(cwd, { fs: fsApi }),
    });
  } catch (error) {
    if (error instanceof SetupError) throw error;
    throw new SetupError(error.message, { cause: error });
  }
}

function printHumanResult(result, output = process.stdout) {
  if (result.migrated) {
    output.write(`Migrated legacy skill files: ${result.moved.join(", ")} (${result.from} -> ${result.to}).\n`);
  } else {
    output.write(`No migration performed: ${result.reason}.\n`);
  }
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const result = await runSetup(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printHumanResult(result);
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

module.exports = { SetupError, main, parseArgs, printHumanResult, runSetup };
