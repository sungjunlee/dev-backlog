/** Explicit GitHub implementation of the optional milestones capability. */

const { execFileSync } = require("child_process");
const { GH_EXEC_DEFAULTS, normalizeGithubTask } = require("./github-tracker.js");

// Isolated-environment failures (#366): the gh call failed because we are not
// inside a git repository / have no GitHub remote. These degrade to "TBD" / []
// so sprint init works in isolated smoke dirs and for cold adopters. Provider
// failures — rate limit, expired auth, partial outage — are NOT isolated and
// must propagate (fail loud).
function isIsolatedGithubError(error) {
  const stderr = String(error.stderr || "") + String(error.message || "");
  return /unable to expand placeholder in path/.test(stderr)
    || /no git remotes found/.test(stderr)
    || /not a git repository/.test(stderr);
}

function getMilestoneDue(milestone, execFile = execFileSync) {
  let output;
  try {
    output = execFile("gh", [
      "api", "repos/{owner}/{repo}/milestones",
      "--jq", '.[] | select(.title==env.MS) | .due_on',
    ], { ...GH_EXEC_DEFAULTS, env: { ...process.env, MS: milestone } }).trim();
  } catch (error) {
    if (isIsolatedGithubError(error)) return "TBD";
    throw error;
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
    if (isIsolatedGithubError(error)) return [];
    throw error;
  }
  return JSON.parse(output).map(normalizeGithubTask);
}

function closeMilestone(milestone, execFile = execFileSync) {
  // Fail-loud (#366): a failed lookup throws so sprint-close aborts before
  // marking the local sprint completed while GitHub stays open.
  const output = execFile("gh", [
    "api", "--paginate", "repos/{owner}/{repo}/milestones?state=all&per_page=100",
    "--jq", '.[] | select(.title==env.MS) | [.number, .state] | @tsv',
  ], { ...GH_EXEC_DEFAULTS, env: { ...process.env, MS: milestone } });
  const rows = String(output).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  if (rows.length === 0) {
    throw new Error("milestone not found: " + milestone);
  }
  const [number, state] = rows[0].split("\t");
  if (state === "closed") {
    return 0; // already closed — no PATCH needed
  }
  // Fail-loud: a failed PATCH throws so sprint-close aborts before marking
  // the local sprint completed while GitHub stays open.
  execFile("gh", [
    "api", "-X", "PATCH", `repos/{owner}/{repo}/milestones/${number}`,
    "-f", "state=closed",
  ], GH_EXEC_DEFAULTS);
  return 1;
}

module.exports = { getMilestoneDue, getMilestoneIssues, closeMilestone, isIsolatedGithubError };
