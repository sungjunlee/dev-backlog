#!/usr/bin/env node
/**
 * Generate a sprint file skeleton from the configured tracker.
 *
 * Usage: ./scripts/sprint-init.js "auth-system"
 *        ./scripts/sprint-init.js "auth-system" --milestone "Sprint W13"
 *        ./scripts/sprint-init.js "auth-system" --component "sprint-execution"
 *        ./scripts/sprint-init.js "auth-system" --scope "src/auth/**"
 *        ./scripts/sprint-init.js "auth-system" --dry-run
 *        ./scripts/sprint-init.js "auth-system" --json
 *
 * First arg is the topic name. Milestone defaults to topic if not specified.
 * Filename: YYYY-MM-<topic>.md
 *
 * GitHub (`.tracker=github`): seeds Plan from a milestone when that capability
 * is reported. Files (`.tracker=files`): due TBD and an empty Plan (add
 * BACK-N refs by hand); never calls GitHub milestone helpers.
 *
 * Multi-track (#292): a second active sprint is refused only when its scope
 * overlaps an existing active track (shared scopesOverlap from lib.js);
 * disjoint tracks are created without refusal; any scopeless track in a
 * multi-track portfolio warns and allows (cannot prove overlap).
 *
 * Spec-free (#426): nothing here reads spec/. `--component` is a free
 * track-scope string compared only by scopesOverlap; `objectives:` is never
 * emitted (optional human-authored metadata the parser still tolerates).
 */

const fs = require("fs");
const path = require("path");
const { renderTaskRef } = require("./task-ref.js");
const { slugify, estimateSize, readConfig, sprintScopeKey, scopesOverlap } = require("./lib");
const { defaultSprintsDir } = require("./execution-root.js");
const { parseFrontmatter } = require("./sprint-state.js");
const { getMilestoneDue, getMilestoneIssues } = require("./github-milestones.js");
const {
  invokeCapability,
  resolveConfiguredTracker,
  writeTrackerCliError,
} = require("./tracker.js");

const USAGE = 'Usage: sprint-init.js "topic" [--milestone "Milestone Name"] [--component "slug" | --scope "glob[,glob]"] [--dry-run] [--json]';

function parseTrackAxis(args) {
  const componentIdx = args.indexOf("--component");
  const scopeIdx = args.indexOf("--scope");
  const component = componentIdx === -1 ? undefined : args[componentIdx + 1];
  const rawScope = scopeIdx === -1 ? undefined : args[scopeIdx + 1];
  if (componentIdx !== -1 && (!component || component.startsWith("--"))) {
    return { error: `Missing value for --component. ${USAGE}` };
  }
  if (scopeIdx !== -1 && (!rawScope || rawScope.startsWith("--"))) {
    return { error: `Missing value for --scope. ${USAGE}` };
  }
  if (componentIdx !== -1 && scopeIdx !== -1) {
    return { error: "--component and --scope cannot be used together; declare one track axis." };
  }
  if (componentIdx !== -1) return { component };
  if (scopeIdx !== -1) {
    return { scope: rawScope.split(",").map((glob) => glob.trim()).filter(Boolean) };
  }
  return {};
}

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

  // Explicit only (D2): the track axis is never inferred from touched paths.
  const trackAxis = parseTrackAxis(filteredArgs);
  if (trackAxis.error) return { ...trackAxis, dryRun, json };
  return { topic, milestone, dryRun, json, ...trackAxis };
}

function filesIssueId(issue) {
  if (!issue || typeof issue !== "object") return null;
  if (issue.tracker === "files") return String(issue.id);
  if (
    issue.number === undefined
    && typeof issue.id === "string"
    && /^[1-9]\d*(?:\.[1-9]\d*)?$/.test(issue.id)
  ) {
    return issue.id;
  }
  return null;
}

function planRefForIssue(issue) {
  if (typeof issue.ref === "string" && issue.ref.trim()) return issue.ref.trim();
  const filesId = filesIssueId(issue);
  if (filesId) return renderTaskRef({ tracker: "files", id: filesId });
  return renderTaskRef({ tracker: "github", id: String(issue.number) });
}

function buildIssueLines(issues) {
  if (!issues.length) return [];

  return issues.map((issue) => {
    const labels = (issue.labels || [])
      .map((label) => (typeof label === "string" ? label : label?.name))
      .filter(Boolean);
    const est = estimateSize(labels);
    const suffix = est ? ` (${est})` : "";
    return `- [ ] ${planRefForIssue(issue)} ${issue.title}${suffix}`;
  });
}

// component: is emitted only when --component was given (#426). It is a free
// track-scope string, resolved against nothing; naming a capability heading is
// a routing convention for relay Learnings, not a checked contract.
// `objectives:` is never generated — it stays optional human-authored metadata
// that the parser tolerates. Existing sprints carrying `objectives: []` /
// `component: ""` remain valid; this is omission-on-generate, not a migration.
function buildComponentFrontmatterLine(component) {
  return component ? `component: "${component}"\n` : "";
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
  component,
  scope,
}) {
  const issueLines = buildIssueLines(issues);
  const componentLine = buildComponentFrontmatterLine(component);
  const scopeLine = buildScopeFrontmatterLine(scope);

  return `---
milestone: ${milestone}
status: active
started: ${started}
due: ${due}
${scopeLine}${componentLine}---

# ${topic}

## Goal
[One sentence: what's true when this sprint is done]

## Plan
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
  component,
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
    ...(component ? { component } : {}),
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
// no longer "any second active sprint". A scopeless track in a multi-track
// portfolio cannot be proven disjoint — warn-and-allow, matching the doctor.
function checkTrackDisjointness({ sprintsDir, component, scope, newTrackFile = "new sprint" }) {
  const activeTracks = loadActiveTrackRecords(sprintsDir);
  const newFrontmatter = component
    ? { component }
    : (Array.isArray(scope) && scope.length ? { scope } : {});

  const conflict = activeTracks.find(
    (track) => scopesOverlap(newFrontmatter, track.frontmatter)
  );
  if (conflict) {
    throw new Error(
      `Active track overlaps on scope: ${conflict.file}. `
      + "Give the new sprint a disjoint component:/scope: or close the conflicting track first."
    );
  }

  const scopelessAfterCreate = [
    ...activeTracks
      .filter((track) => sprintScopeKey(track.frontmatter).kind === "none")
      .map((track) => track.file),
    ...(sprintScopeKey(newFrontmatter).kind === "none" ? [newTrackFile] : []),
  ];
  if (activeTracks.length >= 1 && scopelessAfterCreate.length >= 1) {
    return [
      `Active track(s) without component:/scope: (${scopelessAfterCreate.join(", ")}); `
      + "cannot prove all active tracks are disjoint. Declare component: or scope: on every active track (backlog-doctor will warn).",
    ];
  }
  return [];
}

function trackerUsesMilestones(resolved) {
  if (resolved.tracker === "github") return true;
  const reported = typeof resolved.adapter.capabilities === "function"
    ? resolved.adapter.capabilities()
    : [];
  return Array.isArray(reported) && reported.includes("milestones");
}

function resolveSprintIssueSeed({
  getDue,
  getIssues,
  sprintsDir,
  adapters,
  execFile,
}) {
  if (getDue && getIssues) return { getDue, getIssues };

  const backlogDir = path.dirname(sprintsDir);
  const resolved = resolveConfiguredTracker(readConfig(backlogDir), {
    backlogDir,
    adapters,
    execFile,
  });

  if (trackerUsesMilestones(resolved)) {
    invokeCapability(resolved, "milestones", () => undefined);
    return {
      getDue: getDue || getMilestoneDue,
      getIssues: getIssues || getMilestoneIssues,
    };
  }

  return {
    getDue: getDue || (() => "TBD"),
    getIssues: getIssues || (() => []),
  };
}

function createSprintFile({
  topic,
  milestone,
  component,
  scope,
  dryRun,
  sprintsDir = defaultSprintsDir(),
  today = new Date(),
  fileExists = fs.existsSync,
  mkdir = (dir) => fs.mkdirSync(dir, { recursive: true }),
  writeFile = fs.writeFileSync,
  getDue,
  getIssues,
  adapters,
  execFile,
}) {
  if (component && Array.isArray(scope) && scope.length) {
    throw new Error("--component and --scope cannot be used together; declare one track axis.");
  }
  ({ getDue, getIssues } = resolveSprintIssueSeed({
    getDue,
    getIssues,
    sprintsDir,
    adapters,
    execFile,
  }));

  const datePrefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const started = today.toISOString().slice(0, 10);
  const topicSlug = slugify(topic) || "sprint";
  const sprintFile = path.join(sprintsDir, `${datePrefix}-${topicSlug}.md`);
  const existingFile = fileExists(sprintFile);

  if (existingFile && !dryRun) {
    throw new Error(`Sprint file already exists: ${sprintFile}`);
  }

  const warnings = existingFile
    ? []
    : checkTrackDisjointness({
        sprintsDir,
        component,
        scope,
        newTrackFile: path.basename(sprintFile),
      });

  // Fail-loud ordering (#366): getDue/getIssues run BEFORE any filesystem
  // effect so a gh failure leaves no sprint file (or even sprints dir)
  // behind. Previously getMilestoneDue/getMilestoneIssues swallowed errors
  // as TBD/[], silently writing an empty sprint on a broken provider.
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
        component,
        scope,
      });

  if (!dryRun && !existingFile) {
    mkdir(sprintsDir);
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
    component,
    warnings,
  });
}

function refusalResult(parsed, error) {
  return {
    action: "sprint-init",
    dryRun: parsed.dryRun,
    component: parsed.component ?? null,
    created: false,
    refusalReason: error.message,
  };
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
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  if (parsed.error) {
    if (parsed.json && args.includes("--component")) {
      console.log(JSON.stringify(refusalResult(parsed, new Error(parsed.error)), null, 2));
      process.exit(1);
    }
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
    // Provider-capability failures keep the shared typed error contract from tracker.js
    // ({error: ...}, four scripts, SKILL.md:52) and are deliberately NOT wrapped in the
    // component-aware refusal below. Wrapping them would serialize the same tracker
    // failure two ways depending on whether --component was passed. Issue #331 carries
    // the amended criterion.
    if (writeTrackerCliError(error, { json: parsed.json })) {
      process.exit(1);
    }
    if (parsed.json && parsed.component) {
      console.log(JSON.stringify(refusalResult(parsed, error), null, 2));
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
  buildComponentFrontmatterLine,
  buildScopeFrontmatterLine,
  buildSprintContent,
  listActiveSprintFiles,
  checkTrackDisjointness,
  createSprintFile,
  printResult,
};
