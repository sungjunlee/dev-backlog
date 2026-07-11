/** Explicit GitHub implementation of the optional milestones capability. */

const { execFileSync } = require("child_process");
const { GH_EXEC_DEFAULTS, normalizeGithubTask } = require("./github-tracker.js");

function getMilestoneDue(milestone, execFile = execFileSync) {
  try {
    const output = execFile("gh", [
      "api", "repos/{owner}/{repo}/milestones",
      "--jq", '.[] | select(.title==env.MS) | .due_on',
    ], { ...GH_EXEC_DEFAULTS, env: { ...process.env, MS: milestone } }).trim();
    return output ? output.slice(0, 10) : "TBD";
  } catch {
    return "TBD";
  }
}

function getMilestoneIssues(milestone, execFile = execFileSync) {
  try {
    const output = execFile("gh", [
      "issue", "list", "--milestone", milestone,
      "--state", "open", "--json", "number,title,labels",
    ], GH_EXEC_DEFAULTS);
    return JSON.parse(output).map(normalizeGithubTask);
  } catch {
    return [];
  }
}

function closeMilestone(milestone, execFile = execFileSync, onPatchError = () => {}) {
  const output = execFile("gh", [
    "api", "repos/{owner}/{repo}/milestones",
    "--jq", '.[] | select(.title==env.MS) | .number',
  ], { ...GH_EXEC_DEFAULTS, env: { ...process.env, MS: milestone } });
  const numbers = String(output).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  let closed = 0;
  for (const number of numbers) {
    try {
      execFile("gh", [
        "api", "-X", "PATCH", `repos/{owner}/{repo}/milestones/${number}`,
        "-f", "state=closed",
      ], GH_EXEC_DEFAULTS);
      closed += 1;
    } catch (error) {
      onPatchError(number, error);
    }
  }
  return closed;
}

module.exports = { getMilestoneDue, getMilestoneIssues, closeMilestone };
