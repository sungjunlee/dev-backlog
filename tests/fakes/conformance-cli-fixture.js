const fs = require("node:fs");
const path = require("node:path");

const DRIVER = `#!/usr/bin/node
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const logPath = process.env.CONFORMANCE_INVOCATION_LOG;

function record(status) {
  fs.appendFileSync(logPath, JSON.stringify({ command, args, status }) + "\\n");
}

function finish(status, stdout = "", stderr = "") {
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  record(status);
  process.exit(status);
}

if (command === "node" || command === "bash") {
  const executable = command === "node"
    ? process.env.CONFORMANCE_REAL_NODE
    : process.env.CONFORMANCE_REAL_BASH;
  const result = spawnSync(executable, args, { env: process.env, stdio: "inherit" });
  const status = Number.isInteger(result.status) ? result.status : 1;
  record(status);
  process.exit(status);
}

if (command === "gh") {
  const isView = args[0] === "issue" && args[1] === "view";
  if (isView && process.env.CONFORMANCE_GH_MODE === "fail-read") {
    finish(41, "", "gh: controlled authority read failure\\n");
  }
  if (isView) {
    const number = Number(args[2]) || 42;
    finish(0, JSON.stringify({
      number,
      title: "Controlled task " + number,
      body: "## Acceptance criteria\\n- [ ] preserve the controlled fixture",
      comments: [],
    }));
  }
  if (args[0] === "issue" && ["comment", "edit", "close", "create"].includes(args[1])) {
    finish(0);
  }
  finish(93, "", "unhandled controlled gh argv: " + JSON.stringify(args) + "\\n");
}

if (command === "backlog") {
  if (args[0] === "task" && args[1] === "7" && args[2] === "--plain") {
    finish(0, "# Task 7\\n\\n## Acceptance criteria\\n- [ ] preserve the Backlog.md fixture\\n");
  }
  if (args[0] === "task" && args[1] === "edit" && args[2] === "7") finish(0);
  finish(93, "", "unhandled controlled backlog argv: " + JSON.stringify(args) + "\\n");
}

finish(93, "", "unhandled controlled command: " + command + "\\n");
`;

function installConformanceCliFixture(root, { ghMode = "ok" } = {}) {
  const harnessDir = path.join(root, ".harness");
  const binDir = path.join(harnessDir, "bin");
  const logPath = path.join(harnessDir, "invocations.jsonl");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(logPath, "");
  for (const command of ["node", "bash", "gh", "backlog"]) {
    const commandPath = path.join(binDir, command);
    fs.writeFileSync(commandPath, DRIVER);
    fs.chmodSync(commandPath, 0o755);
  }
  const shellEnv = {
    PATH: `${binDir}${path.delimiter}/usr/local/bin${path.delimiter}/usr/bin${path.delimiter}/bin`,
    CONFORMANCE_INVOCATION_LOG: logPath,
    CONFORMANCE_REAL_NODE: process.execPath,
    CONFORMANCE_REAL_BASH: "/usr/bin/bash",
    CONFORMANCE_GH_MODE: ghMode,
  };
  const env = {
    ...process.env,
    ...shellEnv,
    // Codex itself must still be resolvable; the child sandbox uses shellEnv.PATH.
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
  };
  for (const key of [
    "GH_TOKEN",
    "GITHUB_TOKEN",
    "GH_ENTERPRISE_TOKEN",
    "GH_REPO",
    "GH_HOST",
    "GH_CONFIG_DIR",
    "THREADLINE_TOKEN",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "SSH_AUTH_SOCK",
    "SSH_AGENT_PID",
  ]) {
    delete env[key];
  }
  return {
    logPath,
    env,
    shellEnv,
    invocations() {
      return fs.readFileSync(logPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
  };
}

module.exports = { installConformanceCliFixture };
