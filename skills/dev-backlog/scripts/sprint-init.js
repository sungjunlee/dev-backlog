#!/usr/bin/env node
/**
 * Generate a sprint file skeleton from a GitHub milestone.
 *
 * Usage: ./scripts/sprint-init.js "auth-system"
 *        ./scripts/sprint-init.js "auth-system" --milestone "Sprint W13"
 *        ./scripts/sprint-init.js "auth-system" --scope "src/auth/**"
 *        ./scripts/sprint-init.js "auth-system" --dry-run
 *        ./scripts/sprint-init.js "auth-system" --json
 *
 * First arg is the topic name. Milestone defaults to topic if not specified.
 * Filename: YYYY-MM-<topic>.md
 *
 * Multi-track (#292): a second active sprint is refused only when its scope
 * overlaps an existing active track (shared scopesOverlap from lib.js);
 * disjoint tracks are created without refusal, scopeless-next-to-scopeless
 * warns and allows (cannot prove overlap).
 */

const fs = require("fs");
const path = require("path");
const { renderTaskRef } = require("./task-ref.js");
const { slugify, estimateSize, readConfig, sprintScopeKey, scopesOverlap } = require("./lib");
const { parseFrontmatter } = require("./sprint-state.js");
const { getMilestoneDue, getMilestoneIssues } = require("./github-milestones.js");
const {
  invokeCapability,
  resolveConfiguredTracker,
  writeTrackerCliError,
} = require("./tracker.js");
const { resolveCharterPath } = require("./spec-paths.js");

const USAGE = 'Usage: sprint-init.js "topic" [--milestone "Milestone Name"] [--scope "glob[,glob]"] [--dry-run] [--json]';

function parseArgs(args) {
  const dryRun = args.includes("--dry-run");
  const json = args.includes("--json");
  const filteredArgs = args.filter((a) => a !== "--dry-run" && a !== "--json");

  if (!filteredArgs.length) {
    return { error: USAGE };
  }

  const topic = filteredArgs[0];
  if (topic.startsWith("--")) {
    return { error: USAGE };
  }

  let milestone = topic;
  const msIdx = filteredArgs.indexOf("--milestone");
  if (msIdx !== -1 && filteredArgs[msIdx + 1]) {
    milestone = filteredArgs[msIdx + 1];
  }

  const parsed = { topic, milestone, dryRun, json };

  // Explicit only (D2): scope is never inferred from touched paths.
  const scopeIdx = filteredArgs.indexOf("--scope");
  if (scopeIdx !== -1) {
    const raw = filteredArgs[scopeIdx + 1];
    if (!raw || raw.startsWith("--")) {
      return { error: `Missing value for --scope. ${USAGE}` };
    }
    parsed.scope = raw.split(",").map((glob) => glob.trim()).filter(Boolean);
  }

  return parsed;
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

// scope: is emitted only when explicitly requested (--scope, D2) — a track's
// partition axis is declared, never inferred, and absent scope is never an error.
function buildScopeFrontmatterLine(scope) {
  if (!Array.isArray(scope) || scope.length === 0) return "";
  return `scope: [${scope.map((glob) => `"${glob}"`).join(", ")}]\n`;
}

function buildSprintContent({
  milestone,
  started,
  due,
  topic,
  issues,
  scope,
  hasCharter = false,
  hasCapabilities = false,
}) {
  const issueLines = buildIssueLines(issues);
  const specBlock = buildSpecFrontmatterBlock({ hasCharter, hasCapabilities });
  const scopeLine = buildScopeFrontmatterLine(scope);

  return `---
milestone: ${milestone}
status: active
started: ${started}
due: ${due}
${scopeLine}${specBlock}---

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
  warnings = [],
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
    warnings,
    content,
  };
}

// Track records for the existing active sprints: file name + parsed frontmatter.
function loadActiveTrackRecords(sprintsDir) {
  return listActiveSprintFiles(sprintsDir).map((file) => ({
    file,
    frontmatter: parseFrontmatter(fs.readFileSync(path.join(sprintsDir, file), "utf-8")),
  }));
}

// Refusal is per-track overlap (via the ONE shared scopesOverlap predicate),
// no longer "any second active sprint". Scopeless pairs cannot be proven
// disjoint — warn-and-allow, matching the doctor's informational stance.
function checkTrackDisjointness({ sprintsDir, scope }) {
  const activeTracks = loadActiveTrackRecords(sprintsDir);
  const newFrontmatter = Array.isArray(scope) && scope.length ? { scope } : {};

  const conflict = activeTracks.find(
    (track) => scopesOverlap(newFrontmatter, track.frontmatter)
  );
  if (conflict) {
    throw new Error(
      `Active track overlaps on scope: ${conflict.file}. `
      + "Give the new sprint a disjoint component:/scope: or close the conflicting track first."
    );
  }

  const scopelessAfterCreate = activeTracks
    .filter((track) => sprintScopeKey(track.frontmatter).kind === "none")
    .map((track) => track.file);
  if (sprintScopeKey(newFrontmatter).kind === "none" && scopelessAfterCreate.length >= 1) {
    return [
      `Active track(s) without component:/scope: (${scopelessAfterCreate.join(", ")}); `
      + "cannot prove the new sprint is disjoint. Declare component: or scope: on each track (backlog-doctor will warn).",
    ];
  }
  return [];
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
  scope,
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

  if (existingFile && !dryRun) {
    throw new Error(`Sprint file already exists: ${sprintFile}`);
  }

  const warnings = existingFile ? [] : checkTrackDisjointness({ sprintsDir, scope });

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
        scope,
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
    warnings,
  });
}

function printResult(result) {
  if (result.existingFile && result.dryRun) {
    console.log(`[dry-run] File already exists: ${result.sprintFile}`);
    return;
  }

  for (const warning of result.warnings || []) {
    console.log(`Warning: ${warning}`);
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
  buildScopeFrontmatterLine,
  buildSprintContent,
  detectSpecPresence,
  listActiveSprintFiles,
  checkTrackDisjointness,
  createSprintFile,
  printResult,
};
