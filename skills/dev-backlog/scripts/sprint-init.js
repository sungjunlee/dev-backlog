#!/usr/bin/env node
/**
 * Generate a sprint file skeleton from a GitHub milestone.
 *
 * Usage: ./scripts/sprint-init.js "auth-system"
 *        ./scripts/sprint-init.js "auth-system" --milestone "Sprint W13"
 *        ./scripts/sprint-init.js "auth-system" --dry-run
 *
 * First arg is the topic name. Milestone defaults to topic if not specified.
 * Filename: YYYY-MM-<topic>.md
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// --- Pure functions (exported for testing) ---

function slugify(text) {
  return text.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function estimateSize(labels) {
  for (const l of labels) {
    if (l === "bug" || l === "type:bug") return "~30min";
    if (l === "chore" || l === "type:chore") return "~15min";
  }
  return "";
}

// --- Main execution ---

function main() {
  const args = process.argv.slice(2);
  const DRY_RUN = args.includes("--dry-run");
  const filteredArgs = args.filter((a) => a !== "--dry-run");
  if (!filteredArgs.length) {
    console.log('Usage: sprint-init.js "topic" [--milestone "Milestone Name"] [--dry-run]');
    process.exit(1);
  }

  const TOPIC = filteredArgs[0];
  let MILESTONE = TOPIC;
  const msIdx = filteredArgs.indexOf("--milestone");
  if (msIdx !== -1 && filteredArgs[msIdx + 1]) {
    MILESTONE = filteredArgs[msIdx + 1];
  }

  const SPRINTS_DIR = path.join("backlog", "sprints");
  if (!DRY_RUN) fs.mkdirSync(SPRINTS_DIR, { recursive: true });

  const today = new Date();
  const datePrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const todayStr = today.toISOString().slice(0, 10);

  function getMilestoneDue() {
    try {
      const out = execFileSync("gh", [
        "api", "repos/{owner}/{repo}/milestones",
        "--jq", '.[] | select(.title==env.MS) | .due_on'
      ], { encoding: "utf-8", env: { ...process.env, MS: MILESTONE } }).trim();
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

  const topicSlug = slugify(TOPIC) || "sprint";
  const filepath = path.join(SPRINTS_DIR, `${datePrefix}-${topicSlug}.md`);

  if (fs.existsSync(filepath)) {
    if (DRY_RUN) {
      console.log(`[dry-run] File already exists: ${filepath}`);
    } else {
      console.error(`Sprint file already exists: ${filepath}`);
      process.exit(1);
    }
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

  if (DRY_RUN) {
    console.log(`[dry-run] Would create: ${filepath}\n`);
    console.log(content);
  } else {
    fs.writeFileSync(filepath, content);
    console.log(`Created: ${filepath}\n`);
    console.log(content);
  }
}

if (require.main === module) main();

module.exports = { slugify, estimateSize };
