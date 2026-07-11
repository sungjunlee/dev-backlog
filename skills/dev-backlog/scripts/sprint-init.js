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

const fs = require("fs");
const path = require("path");
const { renderTaskRef } = require("./task-ref.js");
const { slugify, estimateSize, readConfig } = require("./lib");
const { getMilestoneDue, getMilestoneIssues } = require("./github-milestones.js");
const {
  invokeCapability,
  resolveConfiguredTracker,
  writeTrackerCliError,
} = require("./tracker.js");
const { resolveCharterPath } = require("./spec-paths.js");

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
    const ref = renderTaskRef({ tracker: "github", id: String(issue.number) });
    return `- [ ] ${ref} ${issue.title}${suffix}`;
  });
}

// Spec-axis frontmatter is emitted only when the backing spec file exists.
// A cold adopter with no spec/ gets a clean sprint with no empty ceremony; the
// omission semantics live in references/spec-fallback.md. Existing sprints that
// still carry `objectives: []` / `component: ""` remain valid — this is
// omission-on-generate, not a migration.
function buildSpecFrontmatterBlock({ hasCharter, hasCapabilities }) {
  const lines = [];
  if (hasCharter) lines.push("objectives: []");
  if (hasCapabilities) lines.push('component: ""');
  return lines.length ? `${lines.join("\n")}\n` : "";
}

function buildSprintContent({
  milestone,
  started,
  due,
  topic,
  issues,
  hasCharter = false,
  hasCapabilities = false,
}) {
  const issueLines = buildIssueLines(issues);
  const specBlock = buildSpecFrontmatterBlock({ hasCharter, hasCapabilities });

  return `---
milestone: ${milestone}
status: active
started: ${started}
due: ${due}
${specBlock}---

# ${topic}

## Goal
[One sentence: what's true when this sprint is done]

## Plan
[Order into parallel-safe batches. Group small tasks (~30min or less) for one session only when they can run in the same wave.]

${issueLines.join("\n")}

## Running Context
[Decisions and discoveries that carry across tasks in this sprint]

## Progress
[Timestamped log — update at end of each session/batch]
  `;
}

function listActiveSprintFiles(sprintsDir) {
  if (!fs.existsSync(sprintsDir)) return [];

  return fs.readdirSync(sprintsDir)
    .filter((file) => file.endsWith(".md") && file !== "_context.md")
    .filter((file) => {
      const content = fs.readFileSync(path.join(sprintsDir, file), "utf-8");
      return /^status: active$/m.test(content);
    })
    .sort();
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

// Detect whether the spec axis backs each field. Charter resolves canonical
// spec/charter.md or legacy root CHARTER.md; capabilities is spec/capabilities.md.
function detectSpecPresence({ repoRoot = process.cwd(), fileExists = fs.existsSync } = {}) {
  const charter = resolveCharterPath({ repoRoot, fileExists });
  const capabilitiesPath = path.join(repoRoot, "spec", "capabilities.md");
  return {
    hasCharter: charter.found,
    hasCapabilities: fileExists(capabilitiesPath),
  };
}

function createSprintFile({
  topic,
  milestone,
  dryRun,
  sprintsDir = path.join("backlog", "sprints"),
  today = new Date(),
  repoRoot = process.cwd(),
  fileExists = fs.existsSync,
  mkdir = (dir) => fs.mkdirSync(dir, { recursive: true }),
  writeFile = fs.writeFileSync,
  getDue,
  getIssues,
  // Optional overrides; when omitted, detected from repoRoot's spec/ files.
  hasCharter,
  hasCapabilities,
}) {
  if (!getDue || !getIssues) {
    const backlogDir = path.dirname(sprintsDir);
    const resolved = resolveConfiguredTracker(readConfig(backlogDir), { backlogDir });
    invokeCapability(resolved, "milestones", () => undefined);
    getDue = getDue || getMilestoneDue;
    getIssues = getIssues || getMilestoneIssues;
  }
  if (!dryRun) mkdir(sprintsDir);

  const datePrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const started = today.toISOString().slice(0, 10);
  const topicSlug = slugify(topic) || "sprint";
  const sprintFile = path.join(sprintsDir, `${datePrefix}-${topicSlug}.md`);
  const existingFile = fileExists(sprintFile);
  const activeSprintFiles = listActiveSprintFiles(sprintsDir);

  if (existingFile && !dryRun) {
    throw new Error(`Sprint file already exists: ${sprintFile}`);
  }

  if (activeSprintFiles.length > 0 && !existingFile) {
    throw new Error(
      `Active sprint already exists: ${activeSprintFiles.join(", ")}. Close it before creating another active sprint.`
    );
  }

  const detected = detectSpecPresence({ repoRoot, fileExists });
  const charterPresent = hasCharter ?? detected.hasCharter;
  const capabilitiesPresent = hasCapabilities ?? detected.hasCapabilities;

  const due = existingFile ? "TBD" : getDue(milestone);
  const issues = existingFile ? [] : getIssues(milestone);
  const content = existingFile
    ? null
    : buildSprintContent({
        milestone,
        started,
        due,
        topic,
        issues,
        hasCharter: charterPresent,
        hasCapabilities: capabilitiesPresent,
      });

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
    if (writeTrackerCliError(error, { json: parsed.json })) {
      process.exit(1);
    }
    console.error(error.message);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  buildIssueLines,
  buildSpecFrontmatterBlock,
  buildSprintContent,
  detectSpecPresence,
  listActiveSprintFiles,
  createSprintFile,
  printResult,
};
