/** Explicit GitHub transport retained for triage compatibility surfaces. */

const { execFileSync } = require("node:child_process");
const { GH_EXEC_DEFAULTS } = require("../../dev-backlog/scripts/github-tracker.js");

function executeGithub(execFile, args, options = GH_EXEC_DEFAULTS) {
  return execFile("gh", args, options);
}

function runGh(argv, { execFile = execFileSync } = {}) {
  try {
    const stdout = executeGithub(execFile, argv, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout: stdout || "", stderr: "" };
  } catch (error) {
    return {
      status: error.status || 1,
      stdout: typeof error.stdout === "string"
        ? error.stdout
        : error.stdout?.toString?.("utf-8") || "",
      stderr: typeof error.stderr === "string"
        ? error.stderr
        : error.stderr?.toString?.("utf-8") || error.message,
    };
  }
}

module.exports = { executeGithub, runGh };
