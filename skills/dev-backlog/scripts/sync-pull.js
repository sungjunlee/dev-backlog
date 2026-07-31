#!/usr/bin/env node
/**
 * Legacy/export-only projection of open GitHub issues to backlog/tasks/.
 *
 * This is not part of setup, orient, plan, work, or complete. New GitHub
 * repositories should not run it. The CLI requires --legacy-export so an
 * operator cannot accidentally reintroduce task mirrors on the core path.
 *
 * Usage: node scripts/sync-pull.js --legacy-export [PREFIX]
 *
 * Options:
 *   --update    Update existing files (frontmatter only; preserves local AC checkboxes)
 *   --dry-run   Show what would be created/updated without writing files
 *   --json      Print machine-readable summary to stdout
 *   --limit N   Fetch at most N open issues (defaults to all open issues)
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  slugify,
  escapeYaml,
  parseMarkerMonth,
  readConfig,
  getOpenIssueCount: getSharedOpenIssueCount,
} = require("./lib");
const {
  createGithubAdapter,
  stripNormalizedIdentity,
} = require("./github-tracker.js");
const { resolveConfiguredTracker } = require("./tracker.js");
const {
  parseTaskFileName,
  parseTaskRef,
  sameTaskIdentity,
  taskFileRef,
} = require("./task-ref.js");

const ISSUE_JSON_FIELDS = "number,title,body,labels,milestone,assignees";

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

function parseLimitValue(value) {
  if (!/^\d+$/.test(value)) {
    return { error: `Invalid --limit value: ${value}. Expected a positive integer.` };
  }

  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit < 1) {
    return { error: `Invalid --limit value: ${value}. Expected a positive integer.` };
  }

  return { limit };
}

function parseArgs(args, defaultPrefix) {
  const options = {
    prefix: defaultPrefix,
    update: false,
    dryRun: false,
    json: false,
    limit: undefined,
    legacyExport: false,
  };
  let prefixSet = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--update") {
      options.update = true;
      continue;
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--legacy-export") {
      options.legacyExport = true;
      continue;
    }

    if (arg === "--limit") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { ...options, error: "Missing value for --limit. Expected a positive integer." };
      }

      const parsed = parseLimitValue(nextValue);
      if (parsed.error) return { ...options, error: parsed.error };

      options.limit = parsed.limit;
      index += 1;
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const parsed = parseLimitValue(arg.slice("--limit=".length));
      if (parsed.error) return { ...options, error: parsed.error };

      options.limit = parsed.limit;
      continue;
    }

    if (!arg.startsWith("-") && !prefixSet) {
      options.prefix = arg;
      prefixSet = true;
    }
  }

  return options;
}

function makeResult({ tasksDir, prefix, update, dryRun, issueCount }) {
  return {
    action: "sync-pull",
    mode: "legacy-export",
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

function githubTaskIdentity(issueNumber) {
  const identity = parseTaskRef(`#${issueNumber}`);
  if (!identity) throw new Error(`Invalid GitHub issue number: ${issueNumber}`);
  return identity;
}

function findExistingTaskFile({ tasksDir, prefix, identity }) {
  if (!fs.existsSync(tasksDir)) return undefined;
  return fs.readdirSync(tasksDir).find((file) => sameTaskIdentity(
    parseTaskFileName(file, { taskPrefix: prefix, tracker: "github" }),
    identity,
  ));
}

function buildTaskFilename({ issue, prefix, identity = githubTaskIdentity(issue.number) }) {
  const slug = slugify(issue.title) || String(issue.number);
  return `${taskFileRef(identity, { taskPrefix: prefix })} - ${slug}.md`;
}

function buildTaskFrontmatter({
  issue,
  prefix,
  identity = githubTaskIdentity(issue.number),
  today = new Date().toISOString().slice(0, 10),
}) {
  const labelNames = (issue.labels || []).map((label) => label.name);
  const milestone = issue.milestone?.title || "";
  const status = statusFromLabels(labelNames);
  const priority = priorityFromLabels(labelNames);
  const displayLabels = labelNames.filter(
    (label) => !label.startsWith("status:") && !label.startsWith("priority:")
  );
  const labelsYaml = displayLabels.length
    ? "\n" + displayLabels.map((label) => `  - ${label}`).join("\n")
    : " []";

  return `---
id: ${taskFileRef(identity, { taskPrefix: prefix })}
title: ${escapeYaml(issue.title)}
status: ${status}
labels:${labelsYaml}
priority: ${priority}
milestone: ${escapeYaml(milestone)}
created_date: '${today}'
---`;
}

function extractBodyAfterFrontmatter(content) {
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return bodyMatch ? bodyMatch[1] : null;
}

function isMachineManagedIssueBody(body) {
  return parseMarkerMonth(body) !== null;
}

function syncIssueToTaskFile({ issue, tasksDir, prefix, update, dryRun, result }) {
  const identity = githubTaskIdentity(issue.number);
  const filename = buildTaskFilename({ issue, prefix, identity });
  const filepath = path.join(tasksDir, filename);
  const existing = findExistingTaskFile({ tasksDir, prefix, identity });
  const frontmatter = buildTaskFrontmatter({ issue, prefix, identity });
  const structuredBody = structureBody(issue.body || "");

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
    const existingContent = fs.readFileSync(existingPath, "utf-8");
    const nextBody = isMachineManagedIssueBody(issue.body)
      ? structuredBody
      : extractBodyAfterFrontmatter(existingContent) || structuredBody;
    fs.writeFileSync(existingPath, `${frontmatter}\n${nextBody}`);
    recordOperation(result, "updated", existing);
    return existing;
  }

  if (dryRun) {
    recordOperation(result, "created", filename);
    return filename;
  }

  fs.writeFileSync(filepath, frontmatter + structuredBody);
  recordOperation(result, "created", filename);
  return filename;
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

function lstatIfPresent(targetPath) {
  try {
    return fs.lstatSync(targetPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertRealDirectory(targetPath, label) {
  const stat = lstatIfPresent(targetPath);
  if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new Error(`Unsafe task export ${label}: ${targetPath} must be a real directory.`);
  }
  return stat;
}

function cleanupCreatedDirectories(tasksDir, parentDir, { tasksCreated, parentCreated }) {
  if (tasksCreated) {
    try {
      fs.rmdirSync(tasksDir);
    } catch {
      // Only an empty directory created by this invocation is removable.
    }
  }
  if (parentCreated) {
    try {
      fs.rmdirSync(parentDir);
    } catch {
      // Preserve pre-existing, non-empty, replaced, or concurrently used paths.
    }
  }
}

function assertSafeTasksDirectory(tasksDir, { dryRun = false } = {}) {
  const parentDir = path.dirname(tasksDir);
  const containerDir = path.dirname(parentDir);
  assertRealDirectory(containerDir, "parent container");

  let parentCreated = false;
  let tasksCreated = false;
  try {
    const parentStat = lstatIfPresent(parentDir);
    if (!parentStat) {
      if (dryRun) return { parentCreated: false, tasksCreated: false };
      fs.mkdirSync(parentDir);
      parentCreated = true;
      assertRealDirectory(parentDir, "parent");
    } else if (parentStat.isSymbolicLink() || !parentStat.isDirectory()) {
      throw new Error(
        `Unsafe task export parent: ${parentDir} must be a real directory.`
      );
    }

    const tasksStat = lstatIfPresent(tasksDir);
    if (!tasksStat) {
      if (!dryRun) {
        fs.mkdirSync(tasksDir);
        tasksCreated = true;
        assertRealDirectory(tasksDir, "path");
      }
    } else if (tasksStat.isSymbolicLink() || !tasksStat.isDirectory()) {
      throw new Error(`Unsafe task export path: ${tasksDir} must be a real directory.`);
    }
    return { parentCreated, tasksCreated };
  } catch (error) {
    cleanupCreatedDirectories(tasksDir, parentDir, { tasksCreated, parentCreated });
    throw error;
  }
}

function run({ issues, tasksDir, prefix, update, dryRun }) {
  const created = assertSafeTasksDirectory(tasksDir, { dryRun });
  const parentDir = path.dirname(tasksDir);
  const result = makeResult({ tasksDir, prefix, update, dryRun, issueCount: issues.length });
  try {
    issues.forEach((issue) => {
      syncIssueToTaskFile({ issue, tasksDir, prefix, update, dryRun, result });
    });
    return result;
  } catch (error) {
    cleanupCreatedDirectories(tasksDir, parentDir, created);
    throw error;
  }
}

// --- CLI entry point ---

function getOpenIssueCount(execFile = execFileSync) {
  return getSharedOpenIssueCount({ execFile });
}

function fetchOpenIssues(limit, execFile = execFileSync) {
  return createGithubAdapter({ execFile })
    .list({ limit, fields: ISSUE_JSON_FIELDS })
    .map(stripNormalizedIdentity);
}

function loadOpenIssues({
  limit,
  execFile = execFileSync,
  config = {},
  backlogDir,
} = {}) {
  const resolved = resolveConfiguredTracker(config, { execFile, backlogDir });
  return resolved.adapter
    .list({ limit, fields: ISSUE_JSON_FIELDS })
    .map(stripNormalizedIdentity);
}

function printCliError({ code, message, remediation, json }) {
  if (json) {
    console.log(JSON.stringify({ error: { code, message, remediation } }, null, 2));
  } else {
    console.error(`${message}${remediation ? ` ${remediation}` : ""}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const jsonRequested = args.includes("--json");
  const config = readConfig();
  const options = parseArgs(args, config.task_prefix);
  if (options.error) {
    printCliError({
      code: "INVALID_ARGUMENT",
      message: options.error,
      remediation: "Correct the arguments and retry.",
      json: jsonRequested,
    });
    process.exit(1);
  }
  if (!options.legacyExport) {
    printCliError({
      code: "LEGACY_EXPORT_OPT_IN_REQUIRED",
      message: "sync-pull is legacy/export-only and is not part of the GitHub core path.",
      remediation: "Use live Issues through effective-task-spec.js, or rerun with --legacy-export for a deliberate diagnostic export.",
      json: jsonRequested,
    });
    process.exit(2);
  }

  let issues;
  try {
    issues = loadOpenIssues({ limit: options.limit, config, backlogDir: "backlog" });
  } catch (e) {
    const prefix = e?.tracker ? "tracker error" : "gh error";
    const stableCode = typeof e?.code === "string" && e.code.includes("_")
      ? e.code
      : "TASK_EXPORT_SOURCE_UNAVAILABLE";
    printCliError({
      code: stableCode,
      message: `${prefix}: ${e.message}`,
      remediation: e?.remediation || "Verify the configured tracker and provider authentication, then retry.",
      json: jsonRequested,
    });
    process.exit(1);
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

  let result;
  try {
    result = run({
      issues,
      tasksDir: path.join("backlog", "tasks"),
      prefix: options.prefix,
      update: options.update,
      dryRun: options.dryRun,
    });
  } catch (e) {
    printCliError({
      code: "TASK_EXPORT_MATERIALIZATION_FAILED",
      message: `task export materialization failed: ${e.message}`,
      remediation: "Inspect backlog/tasks path safety and write permissions, then retry the explicit legacy export.",
      json: jsonRequested,
    });
    process.exit(1);
  }

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
  getOpenIssueCount,
  fetchOpenIssues,
  loadOpenIssues,
  isMachineManagedIssueBody,
  assertSafeTasksDirectory,
  run,
};
