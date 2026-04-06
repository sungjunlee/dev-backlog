#!/usr/bin/env node
/**
 * Generate a sprint file skeleton from a GitHub milestone.
 *
 * Usage: ./scripts/sprint-init.js "auth-system"
 *        ./scripts/sprint-init.js "auth-system" --milestone "Sprint W13"
 *        ./scripts/sprint-init.js "auth-system" --dry-run
 *        ./scripts/sprint-init.js "auth-system" --json
 *
 * First arg is the topic name. Milestone defaults to topic if not specified.
 * Filename: YYYY-MM-<topic>.md
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { slugify, estimateSize, GH_EXEC_DEFAULTS } = require("./lib");

function parseArgs(args) {
  const dryRun = args.includes("--dry-run");
  const json = args.includes("--json");
  const filteredArgs = args.filter((a) => a !== "--dry-run" && a !== "--json");

  if (!filteredArgs.length) {
    return { error: 'Usage: sprint-init.js "topic" [--milestone "Milestone Name"] [--dry-run] [--json]' };
  }

  const topic = filteredArgs[0];
  if (topic.startsWith("--")) {
    return { error: 'Usage: sprint-init.js "topic" [--milestone "Milestone Name"] [--dry-run] [--json]' };
  }

  let milestone = topic;
  const msIdx = filteredArgs.indexOf("--milestone");
  if (msIdx !== -1 && filteredArgs[msIdx + 1]) {
    milestone = filteredArgs[msIdx + 1];
  }

  return { topic, milestone, dryRun, json };
}

function buildIssueLines(issues) {
  if (!issues.length) return ["- [ ] (add issues here)"];

  return issues.map((issue) => {
    const labels = (issue.labels || []).map((l) => l.name);
    const est = estimateSize(labels);
    const suffix = est ? ` (${est})` : "";
    return `- [ ] #${issue.number} ${issue.title}${suffix}`;
  });
}

function buildSprintContent({ milestone, started, due, topic, issues }) {
  const issueLines = buildIssueLines(issues);

  return `---
milestone: ${milestone}
status: active
started: ${started}
due: ${due}
---

# ${topic}

## Goal
[One sentence: what's true when this sprint is done]

## Plan
[Order into batches. Group small tasks (~30min or less) for one session.]

${issueLines.join("\n")}

## Running Context
[Decisions and discoveries that carry across tasks in this sprint]

## Progress
[Timestamped log — update at end of each session/batch]
`;
}

function createSprintResult({
  topic,
  milestone,
  dryRun,
  sprintFile,
  started,
  due,
  issues,
  content,
  existingFile,
}) {
  return {
    action: "sprint-init",
    dryRun,
    topic,
    milestone,
    sprintFile,
    started,
    due,
    issueCount: issues.length,
    placeholderIssue: Boolean(content) && issues.length === 0,
    existingFile,
    created: !dryRun && !existingFile,
    content,
  };
}

function getMilestoneDue(milestone) {
  try {
    const out = execFileSync("gh", [
      "api", "repos/{owner}/{repo}/milestones",
      "--jq", '.[] | select(.title==env.MS) | .due_on'
    ], { ...GH_EXEC_DEFAULTS, env: { ...process.env, MS: milestone } }).trim();
    return out ? out.slice(0, 10) : "TBD";
  } catch {
    return "TBD";
  }
}

function getMilestoneIssues(milestone) {
  try {
    const out = execFileSync("gh", [
      "issue", "list", "--milestone", milestone,
      "--state", "open", "--json", "number,title,labels"
    ], GH_EXEC_DEFAULTS);
    return JSON.parse(out);
  } catch {
    return [];
  }
}

function createSprintFile({
  topic,
  milestone,
  dryRun,
  sprintsDir = path.join("backlog", "sprints"),
  today = new Date(),
  fileExists = fs.existsSync,
  mkdir = (dir) => fs.mkdirSync(dir, { recursive: true }),
  writeFile = fs.writeFileSync,
  getDue = getMilestoneDue,
  getIssues = getMilestoneIssues,
}) {
  if (!dryRun) mkdir(sprintsDir);

  const datePrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const started = today.toISOString().slice(0, 10);
  const topicSlug = slugify(topic) || "sprint";
  const sprintFile = path.join(sprintsDir, `${datePrefix}-${topicSlug}.md`);
  const existingFile = fileExists(sprintFile);

  if (existingFile && !dryRun) {
    throw new Error(`Sprint file already exists: ${sprintFile}`);
  }

  const due = existingFile ? "TBD" : getDue(milestone);
  const issues = existingFile ? [] : getIssues(milestone);
  const content = existingFile
    ? null
    : buildSprintContent({ milestone, started, due, topic, issues });

  if (!dryRun && !existingFile) {
    writeFile(sprintFile, content);
  }

  return createSprintResult({
    topic,
    milestone,
    dryRun,
    sprintFile,
    started,
    due,
    issues,
    content,
    existingFile,
  });
}

function printResult(result) {
  if (result.existingFile && result.dryRun) {
    console.log(`[dry-run] File already exists: ${result.sprintFile}`);
    return;
  }

  if (result.placeholderIssue) {
    console.log(`No open issues found for milestone: ${result.milestone}`);
    console.log("Create the milestone and assign issues first, or add issues manually.");
  }

  if (result.dryRun) {
    console.log(`[dry-run] Would create: ${result.sprintFile}\n`);
  } else {
    console.log(`Created: ${result.sprintFile}\n`);
  }

  console.log(result.content);
}

// --- Main execution ---

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.log(parsed.error);
    process.exit(1);
  }

  try {
    const result = createSprintFile(parsed);

    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    printResult(result);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  buildIssueLines,
  buildSprintContent,
  createSprintFile,
  printResult,
};
