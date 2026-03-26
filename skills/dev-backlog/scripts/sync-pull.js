#!/usr/bin/env node
/**
 * Pull open GitHub issues to local backlog/tasks/.
 *
 * Usage: ./scripts/sync-pull.js [PREFIX]
 *        node scripts/sync-pull.js [PREFIX]
 *
 * Options:
 *   --update    Update existing files (frontmatter only; preserves local AC checkboxes)
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const UPDATE = args.includes("--update");
const PREFIX = args.find((a) => !a.startsWith("-")) || "BACK";
const TASKS_DIR = path.join("backlog", "tasks");

fs.mkdirSync(TASKS_DIR, { recursive: true });

function slugify(text) {
  return text.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function escapeYaml(text) {
  if (/[:"'#{}\[\]|>&*!%@`]/.test(text) || text !== text.trim()) {
    return "'" + text.replace(/'/g, "''") + "'";
  }
  return text;
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

function findExistingFile(num) {
  const prefix = `${PREFIX}-${num} - `;
  const files = fs.readdirSync(TASKS_DIR);
  return files.find((f) => f.startsWith(prefix) && f.endsWith(".md"));
}

function buildFrontmatter(issue, labelNames) {
  const num = issue.number;
  const title = issue.title;
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
id: ${PREFIX}-${num}
title: ${escapeYaml(title)}
status: ${status}
labels:${labelsYaml}
priority: ${priority}
milestone: ${escapeYaml(milestone)}
created_date: '${today}'
---`;
}

function structureBody(body) {
  if (!body) return "\n## Description\n(No description provided)\n";
  // If body already has ## Description, return as-is
  if (/^##\s+Description/m.test(body)) return "\n" + body + "\n";
  return "\n## Description\n" + body + "\n";
}

function writeTaskFile(issue) {
  const num = issue.number;
  const title = issue.title;
  const slug = slugify(title);
  const filename = `${PREFIX}-${num} - ${slug}.md`;
  const filepath = path.join(TASKS_DIR, filename);
  const labelNames = (issue.labels || []).map((l) => l.name);
  const body = issue.body || "";

  const existing = findExistingFile(num);
  if (existing) {
    if (!UPDATE) {
      console.log(`  skip: ${existing} (exists, use --update to refresh)`);
      return;
    }
    // Update: replace frontmatter, preserve body (local AC checkboxes)
    const existingPath = path.join(TASKS_DIR, existing);
    const content = fs.readFileSync(existingPath, "utf-8");
    const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    const existingBody = bodyMatch ? bodyMatch[1] : structureBody(body);
    const newContent = buildFrontmatter(issue, labelNames) + "\n" + existingBody;
    fs.writeFileSync(existingPath, newContent);
    console.log(`  update: ${existing}`);
    return;
  }

  const content = buildFrontmatter(issue, labelNames) + structureBody(body);
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
