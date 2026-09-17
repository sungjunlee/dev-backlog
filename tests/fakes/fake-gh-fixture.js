/**
 * Test fixture: installs the fake gh from fake-gh.js into a temp bin/ dir and
 * returns env/calls/state accessors. Extracted verbatim from
 * tracker-cycle.acceptance.test.js (#366); see fake-gh.js for FAKE_GH_FAIL
 * failure-injection modes.
 */

const fs = require("node:fs");
const path = require("node:path");
const { GH_SCRIPT } = require("./fake-gh.js");

function writeGhFixture(root) {
  const binDir = path.join(root, "bin");
  const statePath = path.join(root, "gh-state.json");
  const logPath = path.join(root, "gh-argv.jsonl");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({
    nextIssue: 42,
    issues: [],
    milestoneClosed: false,
  }));
  const ghPath = path.join(binDir, "gh");
  fs.writeFileSync(ghPath, GH_SCRIPT);
  fs.chmodSync(ghPath, 0o755);
  if (process.platform === "win32") {
    fs.writeFileSync(`${ghPath}.cmd`, `@echo off\r\n"${process.execPath}" "${ghPath}" %*\r\n`);
  }
  const preloadPath = path.join(root, "mock-gh-preload.cjs");
  fs.writeFileSync(preloadPath, `
const childProcess = require("node:child_process");
const original = childProcess.execFileSync;
childProcess.execFileSync = function (command, args, options) {
  if (command === "gh") return original(process.execPath, [${JSON.stringify(ghPath)}, ...args], options);
  return original(command, args, options);
};
`);
  return {
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
      NODE_OPTIONS: `--require=${preloadPath}`,
      FAKE_GH_STATE: statePath,
      FAKE_GH_LOG: logPath,
    },
    calls: () => fs.existsSync(logPath)
      ? fs.readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      : [],
    state: () => JSON.parse(fs.readFileSync(statePath, "utf8")),
  };
}

module.exports = { writeGhFixture };
