#!/usr/bin/env node
/**
 * Generate a sprint file skeleton from a GitHub milestone.
 *
 * Usage: ./scripts/sprint-init.js "auth-system"
 *        ./scripts/sprint-init.js "auth-system" --milestone "Sprint W13"
 *
 * First arg is the topic name. Milestone defaults to topic if not specified.
 * Filename: YYYY-MM-<topic>.md
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
if (!args.length) {
  console.log('Usage: sprint-init.js "topic" [--milestone "Milestone Name"]');
  process.exit(1);
}

const TOPIC = args[0];
let MILESTONE = TOPIC;
const msIdx = args.indexOf("--milestone");
if (msIdx !== -1 && args[msIdx + 1]) {
  MILESTONE = args[msIdx + 1];
}

const SPRINTS_DIR = path.join("backlog", "sprints");
fs.mkdirSync(SPRINTS_DIR, { recursive: true });

const today = new Date();
const datePrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
const todayStr = today.toISOString().slice(0, 10);

function slugify(text) {
  return text.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function getMilestoneDue() {
  try {
    const jqFilter = `.[] | select(.title=="${MILESTONE.replace(/"/g, '\\"')}") | .due_on`;
    const out = execFileSync("gh", [
      "api", "repos/{owner}/{repo}/milestones", "--jq", jqFilter
    ], { encoding: "utf-8" }).trim();
    return out ? out.slice(0, 10) : "TBD";
  } catch {
    return "TBD";
  }
}

function getMilestoneIssues() {
  try {
    const out = execFileSync("gh", [
      "issue", "list", "--milestone", MILESTONE,
      "--state", "open", "--json", "number,title,labels"
    ], { encoding: "utf-8" });
    return JSON.parse(out);
  } catch {
    return [];
  }
}

function estimateSize(labels) {
  for (const l of labels) {
    if (l === "bug" || l === "type:bug") return "~30min";
    if (l === "chore" || l === "type:chore") return "~15min";
  }
  return "";
}

const filepath = path.join(SPRINTS_DIR, `${datePrefix}-${slugify(TOPIC)}.md`);

if (fs.existsSync(filepath)) {
  console.log(`Sprint file already exists: ${filepath}`);
  process.exit(1);
}

const due = getMilestoneDue();
const issues = getMilestoneIssues();

if (!issues.length) {
  console.log(`No open issues found for milestone: ${MILESTONE}`);
  console.log("Create the milestone and assign issues first, or add issues manually.");
}

const issueLines = issues.length
  ? issues.map((issue) => {
      const labels = (issue.labels || []).map((l) => l.name);
      const est = estimateSize(labels);
      const suffix = est ? ` (${est})` : "";
      return `- [ ] #${issue.number} ${issue.title}${suffix}`;
    })
  : ["- [ ] (add issues here)"];

const content = `---
milestone: ${MILESTONE}
status: active
started: ${todayStr}
due: ${due}
---

# ${TOPIC}

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

fs.writeFileSync(filepath, content);
console.log(`Created: ${filepath}\n`);
console.log(content);
