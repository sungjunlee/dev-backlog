#!/usr/bin/env node
/**
 * Pull open GitHub issues to local backlog/tasks/.
 *
 * Usage: ./scripts/sync-pull.js [PREFIX]
 *        node scripts/sync-pull.js [PREFIX]
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PREFIX = process.argv[2] || "BACK";
const TASKS_DIR = path.join("backlog", "tasks");

fs.mkdirSync(TASKS_DIR, { recursive: true });

function slugify(text) {
  return text.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function getOpenIssues() {
  try {
    const out = execSync(
      'gh issue list --state open --limit 100 --json number,title,body,labels,milestone,assignees',
      { encoding: "utf-8" }
    );
    return JSON.parse(out);
  } catch (e) {
    console.error(`gh error: ${e.message}`);
    process.exit(1);
  }
}

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

function writeTaskFile(issue) {
  const num = issue.number;
  const title = issue.title;
  const slug = slugify(title);
  const filename = `${PREFIX}-${num} - ${slug}.md`;
  const filepath = path.join(TASKS_DIR, filename);

  if (fs.existsSync(filepath)) {
    console.log(`  skip: ${filename} (exists)`);
    return;
  }

  const labelNames = (issue.labels || []).map((l) => l.name);
  const milestone = issue.milestone?.title || "";
  const body = issue.body || "";

  const status = statusFromLabels(labelNames);
  const priority = priorityFromLabels(labelNames);

  const displayLabels = labelNames.filter(
    (l) => !l.startsWith("status:") && !l.startsWith("priority:")
  );
  const labelsYaml = displayLabels.length
    ? displayLabels.map((l) => `  - ${l}`).join("\n")
    : "  []";

  const today = new Date().toISOString().slice(0, 10);

  const content = `---
id: ${PREFIX}-${num}
title: "${title}"
status: ${status}
labels:
${labelsYaml}
priority: ${priority}
milestone: "${milestone}"
created_date: '${today}'
---

${body}
`;

  fs.writeFileSync(filepath, content);
  console.log(`  pull: ${filename}`);
}

const issues = getOpenIssues();
if (!issues.length) {
  console.log("No open issues found.");
  process.exit(0);
}

console.log(`Found ${issues.length} open issues. Syncing to ${TASKS_DIR}/`);
issues.forEach(writeTaskFile);
console.log("Done.");
