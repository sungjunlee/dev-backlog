#!/usr/bin/env node

const { readConfig } = require("./lib.js");
const { resolveConfiguredTracker } = require("./tracker.js");

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

function main() {
  try {
    process.stdout.write(`${listStatusRows(process.argv[2]).join("\n")}\n`);
  } catch (error) {
    const message = error?.tracker
      ? `(tracker unavailable: ${error.message})`
      : "(gh not available)";
    process.stdout.write(`${message}\n`);
  }
}

if (require.main === module) main();

module.exports = { listStatusRows };
