/** Explicit GitHub implementation of the optional milestones capability. */

const { execFileSync } = require("child_process");
const { GH_EXEC_DEFAULTS, normalizeGithubTask } = require("./github-tracker.js");

// Fail-loud for the three provider-failure classes (#366): rate limit,
// expired auth, and partial outage must propagate. Everything else — missing
// GitHub remote, unknown milestone — degrades to "TBD" / [] so sprint init
// works in isolated smoke dirs and for cold adopters.
function isProviderOutage(error) {
  const stderr = String(error.stderr || "") + String(error.message || "");
  return /API rate limit exceeded/.test(stderr)
    || /HTTP 401/.test(stderr) || /authentication required/.test(stderr)
    || /GitHub unavailable/.test(stderr);
}

function getMilestoneDue(milestone, execFile = execFileSync) {
  let output;
  try {
    output = execFile("gh", [
      "api", "repos/{owner}/{repo}/milestones",
      "--jq", '.[] | select(.title==env.MS) | .due_on',
    ], { ...GH_EXEC_DEFAULTS, env: { ...process.env, MS: milestone } }).trim();
  } catch (error) {
    if (isProviderOutage(error)) throw error;
    return "TBD";
  }
  return output ? output.slice(0, 10) : "TBD";
}

function getMilestoneIssues(milestone, execFile = execFileSync) {
  let output;
  try {
    output = execFile("gh", [
      "issue", "list", "--milestone", milestone,
      "--state", "open", "--json", "number,title,labels",
    ], GH_EXEC_DEFAULTS);
  } catch (error) {
    if (isProviderOutage(error)) throw error;
    return [];
  }
  return JSON.parse(output).map(normalizeGithubTask);
}

function closeMilestone(milestone, execFile = execFileSync) {
  // Fail-loud (#366): a failed lookup throws so sprint-close aborts before
  // marking the local sprint completed while GitHub stays open.
  const output = execFile("gh", [
    "api", "repos/{owner}/{repo}/milestones",
    "--jq", '.[] | select(.title==env.MS) | .number',
  ], { ...GH_EXEC_DEFAULTS, env: { ...process.env, MS: milestone } });
  const numbers = String(output).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  let closed = 0;
  for (const number of numbers) {
    // Fail-loud: a failed PATCH throws so sprint-close aborts before marking
    // the local sprint completed while GitHub stays open.
    execFile("gh", [
      "api", "-X", "PATCH", `repos/{owner}/{repo}/milestones/${number}`,
      "-f", "state=closed",
    ], GH_EXEC_DEFAULTS);
    closed += 1;
  }
  return closed;
}

module.exports = { getMilestoneDue, getMilestoneIssues, closeMilestone };
