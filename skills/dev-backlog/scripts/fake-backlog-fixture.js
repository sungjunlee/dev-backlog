/**
 * Test fixture: installs the fake backlog from fake-backlog.js into a temp
 * bin/ dir and returns env/calls/state accessors. Mirrors fake-gh-fixture.js.
 */

const fs = require("node:fs");
const path = require("node:path");
const { BACKLOG_SCRIPT } = require("./fake-backlog.js");

function writeBacklogFixture(root, { nextId = 12, tasks = [] } = {}) {
  const binDir = path.join(root, "bin");
  const statePath = path.join(root, "backlog-state.json");
  const logPath = path.join(root, "backlog-argv.jsonl");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({
    nextId,
    prefix: "BACK",
    tasks,
  }));
  const backlogPath = path.join(binDir, "backlog");
  fs.writeFileSync(backlogPath, BACKLOG_SCRIPT);
  fs.chmodSync(backlogPath, 0o755);
  if (process.platform === "win32") {
    fs.writeFileSync(`${backlogPath}.cmd`, `@echo off\r\n"${process.execPath}" "${backlogPath}" %*\r\n`);
  }
  const preloadPath = path.join(root, "mock-backlog-preload.cjs");
  fs.writeFileSync(preloadPath, `
const childProcess = require("node:child_process");
const original = childProcess.execFileSync;
childProcess.execFileSync = function (command, args, options) {
  if (command === "backlog") return original(process.execPath, [${JSON.stringify(backlogPath)}, ...args], options);
  return original(command, args, options);
};
`);
  return {
    backlogPath,
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
      NODE_OPTIONS: `--require=${preloadPath}`,
      FAKE_BACKLOG_STATE: statePath,
      FAKE_BACKLOG_LOG: logPath,
    },
    calls: () => fs.existsSync(logPath)
      ? fs.readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      : [],
    state: () => JSON.parse(fs.readFileSync(statePath, "utf8")),
  };
}

module.exports = { writeBacklogFixture };
