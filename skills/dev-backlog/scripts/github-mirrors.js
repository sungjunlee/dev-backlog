/** Explicit GitHub implementation of the optional sprint-mirror capability. */

const { GH_EXEC_DEFAULTS } = require("./github-tracker.js");

function findMirrorIssue(marker, execFile) {
  const output = execFile("gh", [
    "issue", "list", "--state", "all",
    "--search", "dev-backlog:sprint-mirror in:body",
    "--json", "number,body", "--limit", "50",
  ], GH_EXEC_DEFAULTS);
  const issues = JSON.parse(output);
  return issues.find((issue) => issue.body && issue.body.includes(marker)) || null;
}

function createMirrorIssue(title, body, execFile) {
  const output = execFile(
    "gh",
    ["issue", "create", "--title", title, "--body", body],
    GH_EXEC_DEFAULTS
  );
  const match = String(output).trim().match(/\/issues\/(\d+)\s*$/);
  if (!match) {
    throw new Error(`Failed to parse issue number from gh output: ${String(output).trim()}`);
  }
  return { number: Number(match[1]) };
}

function updateMirrorIssue(number, body, execFile) {
  execFile("gh", ["issue", "edit", String(number), "--body", body], GH_EXEC_DEFAULTS);
}

module.exports = { findMirrorIssue, createMirrorIssue, updateMirrorIssue };
