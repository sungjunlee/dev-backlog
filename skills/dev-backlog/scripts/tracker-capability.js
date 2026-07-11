#!/usr/bin/env node

const { readConfig } = require("./lib.js");
const { invokeCapability, resolveConfiguredTracker } = require("./tracker.js");
const { closeMilestone } = require("./github-milestones.js");

function requireCapability(capability, backlogDir = "backlog") {
  const resolved = resolveConfiguredTracker(readConfig(backlogDir));
  return invokeCapability(resolved, capability, () => resolved);
}

function main() {
  const [operation, capability, backlogDir = "backlog", value] = process.argv.slice(2);
  try {
    const resolved = requireCapability(capability, backlogDir);
    if (operation === "require") return;
    if (operation === "close-milestone") {
      const count = invokeCapability(resolved, "milestones", () => closeMilestone(
        value,
        undefined,
        () => console.log(`Warning: Could not close milestone: ${value}`)
      ));
      if (count > 0) console.log(`Closed milestone: ${value}`);
      return;
    }
    throw new Error(`Unknown tracker capability operation: ${operation}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { requireCapability };
