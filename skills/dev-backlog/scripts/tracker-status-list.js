#!/usr/bin/env node

const { readConfig } = require("./lib.js");
const { resolveConfiguredTracker } = require("./tracker.js");
const { isIsolatedGithubError } = require("./github-milestones.js");

function listStatusRows(backlogDir = "backlog", { execFile } = {}) {
  const resolved = resolveConfiguredTracker(readConfig(backlogDir), { execFile, backlogDir });
  return resolved.adapter.list({
    state: "open",
    limit: 20,
    fields: "number,title,labels,milestone",
  }).map((task) => [
    task.number ?? task.ref,
    task.milestone?.title || "-",
    task.title,
    (task.labels || []).map((label) => typeof label === "string" ? label : label.name).join(","),
  ].join("\t"));
}

function isStatusFallbackError(error) {
  if (isIsolatedGithubError(error) || error.tracker || error.name === "TrackerConfigurationError") {
    return true;
  }
  const text = String(error.stderr || "") + String(error.message || "");
  return /GH_TOKEN/.test(text)
    || /To use GitHub CLI in a GitHub Actions workflow/.test(text)
    || /gh auth login/.test(text);
}

function main() {
  try {
    process.stdout.write(`${listStatusRows(process.argv[2]).join("\n")}\n`);
  } catch (error) {
    if (isStatusFallbackError(error)) {
      process.stdout.write("(gh not available)\n");
      return;
    }
    // Fail loud (#366): provider failures surface stderr and exit non-zero.
    process.stderr.write(String(error.stderr || error.message) + "\n");
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { listStatusRows, isStatusFallbackError };
