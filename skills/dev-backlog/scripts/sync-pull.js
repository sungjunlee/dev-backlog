#!/usr/bin/env node
/**
 * Pull open GitHub issues to local backlog/tasks/.
 *
 * Usage: ./scripts/sync-pull.js [PREFIX]
 *        node scripts/sync-pull.js [PREFIX]
 *
 * Options:
 *   --update    Update existing files (frontmatter only; preserves local AC checkboxes)
 *   --dry-run   Show what would be created/updated without writing files
 *   --json      Print machine-readable summary to stdout
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { slugify, escapeYaml, readConfig } = require("./lib");

function statusFromLabels(labels) {
  if (labels.includes("status:in-progress")) return "In Progress";
  if (labels.includes("status:blocked")) return "Blocked";
  if (labels.includes("status:in-review")) return "In Review";
  return "To Do";
}

function priorityFromLabels(labels) {
  for (const p of ["critical", "high", "low"]) {
    if (labels.includes(`priority:${p}`)) return p;
  }
  return "medium";
}

function structureBody(body) {
  if (!body) return "\n## Description\n(No description provided)\n";
  if (/^##\s+Description/m.test(body)) return "\n" + body + "\n";
  return "\n## Description\n" + body + "\n";
}

function parseArgs(args, defaultPrefix) {
  return {
    prefix: args.find((a) => !a.startsWith("-")) || defaultPrefix,
    update: args.includes("--update"),
    dryRun: args.includes("--dry-run"),
    json: args.includes("--json"),
  };
}

function makeResult({ tasksDir, prefix, update, dryRun, issueCount }) {
  return {
    action: "sync-pull",
    dryRun,
    update,
    prefix,
    tasksDir,
    issueCount,
    counts: {
      created: 0,
      updated: 0,
      skipped: 0,
    },
    createdFiles: [],
    updatedFiles: [],
    skippedFiles: [],
    operations: [],
  };
}

function recordOperation(result, type, file) {
  result.counts[type] += 1;
  result.operations.push({ type, file });
  if (type === "created") result.createdFiles.push(file);
  if (type === "updated") result.updatedFiles.push(file);
  if (type === "skipped") result.skippedFiles.push(file);
}

function printResult(result) {
  const label = result.dryRun ? "[dry-run] " : "";
  console.log(`${label}Found ${result.issueCount} open issues. Syncing to ${result.tasksDir}/`);

  for (const op of result.operations) {
    if (op.type === "created") {
      console.log(result.dryRun ? `  would create: ${op.file}` : `  pull: ${op.file}`);
    } else if (op.type === "updated") {
      console.log(result.dryRun ? `  would update: ${op.file}` : `  update: ${op.file}`);
    } else {
      console.log(`  skip: ${op.file} (exists, use --update to refresh)`);
    }
  }

  console.log("Done.");
}

// --- Core logic (testable) ---

function run({ issues, tasksDir, prefix, update, dryRun }) {
  if (!dryRun) fs.mkdirSync(tasksDir, { recursive: true });
  const result = makeResult({ tasksDir, prefix, update, dryRun, issueCount: issues.length });

  function findExistingFile(num) {
    const pfx = `${prefix}-${num} - `;
    if (!fs.existsSync(tasksDir)) return undefined;
    const files = fs.readdirSync(tasksDir);
    return files.find((f) => f.startsWith(pfx) && f.endsWith(".md"));
  }

  function buildFrontmatter(issue, labelNames) {
    const milestone = issue.milestone?.title || "";
    const status = statusFromLabels(labelNames);
    const priority = priorityFromLabels(labelNames);
    const displayLabels = labelNames.filter(
      (l) => !l.startsWith("status:") && !l.startsWith("priority:")
    );
    const labelsYaml = displayLabels.length
      ? "\n" + displayLabels.map((l) => `  - ${l}`).join("\n")
      : " []";
    const today = new Date().toISOString().slice(0, 10);

    return `---
id: ${prefix}-${issue.number}
title: ${escapeYaml(issue.title)}
status: ${status}
labels:${labelsYaml}
priority: ${priority}
milestone: ${escapeYaml(milestone)}
created_date: '${today}'
---`;
  }

  function writeTaskFile(issue) {
    const num = issue.number;
    const slug = slugify(issue.title) || String(num);
    const filename = `${prefix}-${num} - ${slug}.md`;
    const filepath = path.join(tasksDir, filename);
    const labelNames = (issue.labels || []).map((l) => l.name);
    const body = issue.body || "";

    const existing = findExistingFile(num);
    if (existing) {
      if (!update) {
        recordOperation(result, "skipped", existing);
        return existing;
      }
      if (dryRun) {
        recordOperation(result, "updated", existing);
        return existing;
      }
      const existingPath = path.join(tasksDir, existing);
      const content = fs.readFileSync(existingPath, "utf-8");
      const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
      const existingBody = bodyMatch ? bodyMatch[1] : structureBody(body);
      const newContent = buildFrontmatter(issue, labelNames) + "\n" + existingBody;
      fs.writeFileSync(existingPath, newContent);
      recordOperation(result, "updated", existing);
      return existing;
    }

    if (dryRun) {
      recordOperation(result, "created", filename);
      return filename;
    }
    const content = buildFrontmatter(issue, labelNames) + structureBody(body);
    fs.writeFileSync(filepath, content);
    recordOperation(result, "created", filename);
    return filename;
  }

  issues.forEach(writeTaskFile);
  return result;
}

// --- CLI entry point ---

function main() {
  const args = process.argv.slice(2);
  const config = readConfig();
  const options = parseArgs(args, config.task_prefix);

  let issues;
  try {
    const out = execFileSync("gh", [
      "issue", "list", "--state", "open", "--limit", "100",
      "--json", "number,title,body,labels,milestone,assignees"
    ], { encoding: "utf-8" });
    issues = JSON.parse(out);
  } catch (e) {
    console.error(`gh error: ${e.message}`);
    process.exit(1);
  }

  if (issues.length >= 100) {
    console.warn("Warning: 100 issues fetched (limit). Some issues may be missing.");
  }
  if (!issues.length) {
    if (options.json) {
      console.log(JSON.stringify(makeResult({
        tasksDir: path.join("backlog", "tasks"),
        prefix: options.prefix,
        update: options.update,
        dryRun: options.dryRun,
        issueCount: 0,
      }), null, 2));
    } else {
      console.log("No open issues found.");
    }
    process.exit(0);
  }

  const result = run({
    issues,
    tasksDir: path.join("backlog", "tasks"),
    prefix: options.prefix,
    update: options.update,
    dryRun: options.dryRun,
  });

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printResult(result);
}

if (require.main === module) main();

module.exports = {
  statusFromLabels,
  priorityFromLabels,
  structureBody,
  parseArgs,
  makeResult,
  printResult,
  run,
};
