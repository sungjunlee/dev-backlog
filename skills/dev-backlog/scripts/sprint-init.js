#!/usr/bin/env node
/**
 * Generate an empty sprint file skeleton.
 *
 * Usage: ./scripts/sprint-init.js "auth-system"
 *        ./scripts/sprint-init.js "auth-system" --milestone "Sprint W13"
 *        ./scripts/sprint-init.js "auth-system" --component "sprint-execution"
 *        ./scripts/sprint-init.js "auth-system" --scope "src/auth/**"
 *        ./scripts/sprint-init.js "auth-system" --dry-run
 *        ./scripts/sprint-init.js "auth-system" --json
 *
 * First arg is the topic name. Milestone defaults to topic if not specified
 * and is written to frontmatter verbatim; nothing is read from GitHub.
 * Filename: YYYY-MM-<topic>.md
 *
 * The Plan is written empty (#445): listing Issues is a `gh issue list` the
 * session runs itself, and the model writes the batches.
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
const { slugify, sprintScopeKey, scopesOverlap } = require("./lib");
const { defaultSprintsDir } = require("./execution-root.js");
const { parseFrontmatter } = require("./sprint-state.js");

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

// component: is emitted only when --component was given (#426). It is a free
// track-scope string, resolved against nothing; naming a capability heading is
// a routing convention for relay Learnings, not a checked contract.
// `objectives:` is never generated — it stays optional human-authored metadata
// that the parser tolerates. Existing sprints carrying `objectives: []` /
// `component: ""` remain valid; this is omission-on-generate, not a migration.
// component: is a free track-scope string (charter rev 18); it must survive the
// frontmatter round-trip unchanged, so reject anything that could break the
// line (whitespace, quotes, newlines) before any file is written.
const COMPONENT_RE = /^[^\s"]+$/;
function buildComponentFrontmatterLine(component) {
  if (!component) return "";
  if (!COMPONENT_RE.test(component)) {
    throw new Error(`--component must be a single token without whitespace or quotes; got ${JSON.stringify(component)}`);
  }
  return `component: "${component}"\n`;
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
  component,
  scope,
}) {
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
    issueCount: 0,
    placeholderIssue: Boolean(content),
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
}) {
  if (component && Array.isArray(scope) && scope.length) {
    throw new Error("--component and --scope cannot be used together; declare one track axis.");
  }

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

  // `due:` is human-owned metadata (#445): nothing is read from GitHub here,
  // so sprint-init never touches the network and never fails on provider state.
  const due = "TBD";
  const content = existingFile
    ? null
    : buildSprintContent({
        milestone,
        started,
        due,
        topic,
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
    console.log("The Plan is empty: add `- [ ] #N Title` items for the work this track carries.");
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
  buildComponentFrontmatterLine,
  buildScopeFrontmatterLine,
  buildSprintContent,
  listActiveSprintFiles,
  checkTrackDisjointness,
  createSprintFile,
  printResult,
};
