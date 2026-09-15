/**
 * Test fixture: installs the fake glab from fake-glab.js into a temp bin/ dir
 * and returns env/calls/state accessors. Mirrors fake-gh-fixture.js.
 */

const fs = require("node:fs");
const path = require("node:path");
const { GLAB_SCRIPT } = require("./fake-glab.js");

function writeGlabFixture(root, { nextIid = 12, issues = [], authenticated = true } = {}) {
  const binDir = path.join(root, "bin");
  const statePath = path.join(root, "glab-state.json");
  const logPath = path.join(root, "glab-argv.jsonl");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({
    nextIid,
    authenticated,
    issues,
  }));
  const glabPath = path.join(binDir, "glab");
  fs.writeFileSync(glabPath, GLAB_SCRIPT);
  fs.chmodSync(glabPath, 0o755);
  if (process.platform === "win32") {
    fs.writeFileSync(`${glabPath}.cmd`, `@echo off\r\n"${process.execPath}" "${glabPath}" %*\r\n`);
  }
  const preloadPath = path.join(root, "mock-glab-preload.cjs");
  fs.writeFileSync(preloadPath, `
const childProcess = require("node:child_process");
const original = childProcess.execFileSync;
childProcess.execFileSync = function (command, args, options) {
  if (command === "glab") return original(process.execPath, [${JSON.stringify(glabPath)}, ...args], options);
  return original(command, args, options);
};
`);
  return {
    glabPath,
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
      NODE_OPTIONS: `--require=${preloadPath}`,
      FAKE_GLAB_STATE: statePath,
      FAKE_GLAB_LOG: logPath,
    },
    calls: () => fs.existsSync(logPath)
      ? fs.readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      : [],
    state: () => JSON.parse(fs.readFileSync(statePath, "utf8")),
  };
}

module.exports = { writeGlabFixture };
