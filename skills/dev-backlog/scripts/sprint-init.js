#!/usr/bin/env node
/**
 * Generate an empty sprint file skeleton. Filename: YYYY-MM-<topic>.md
 *
 * Usage: ./scripts/sprint-init.js "auth-system"
 *        ./scripts/sprint-init.js "auth-system" --milestone "Sprint W13"
 *        ./scripts/sprint-init.js "auth-system" --component "sprint-execution"
 *        ./scripts/sprint-init.js "auth-system" --scope "src/auth/**"
 *
 * Milestone defaults to topic. Plan is empty (#445). Overlap uses shared
 * scopesOverlap (#292). Nothing reads spec/; `--component` is a free string
 * (#426); `objectives:` is never emitted.
 */

const fs = require("fs");
const path = require("path");
const { slugify, sprintScopeKey, scopesOverlap } = require("./lib");
const { defaultSprintsDir } = require("./execution-root.js");
const { parseFrontmatter } = require("./sprint-state.js");

const USAGE = 'Usage: sprint-init.js "topic" [--milestone "Milestone Name"] [--component "slug" | --scope "glob[,glob]"]';

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
  if (!args.length) return { error: USAGE };
  const topic = args[0];
  if (topic.startsWith("--")) return { error: USAGE };

  const KNOWN_FLAGS = ["--milestone", "--component", "--scope"];
  for (let i = 1; i < args.length; i += 1) {
    if (args[i].startsWith("--") && !KNOWN_FLAGS.includes(args[i])) {
      return { error: `Unknown argument: ${args[i]}. ${USAGE}` };
    }
    if (KNOWN_FLAGS.includes(args[i])) i += 1;
  }

  // Explicit only (D2): the track axis is never inferred from touched paths.
  const trackAxis = parseTrackAxis(args);
  if (trackAxis.error) return trackAxis;

  let milestone = topic;
  const msIdx = args.indexOf("--milestone");
  if (msIdx !== -1) {
    if (!args[msIdx + 1] || args[msIdx + 1].startsWith("--")) {
      return { error: `Missing value for --milestone. ${USAGE}` };
    }
    milestone = args[msIdx + 1];
  }
  return { topic, milestone, ...trackAxis };
}

// component: only when --component is given (#426). Reject tokens that cannot
// round-trip through frontmatter (whitespace, quotes, newlines).
const COMPONENT_RE = /^[^\s"]+$/;
function buildComponentFrontmatterLine(component) {
  if (!component) return "";
  if (!COMPONENT_RE.test(component)) {
    throw new Error(`--component must be a single token without whitespace or quotes; got ${JSON.stringify(component)}`);
  }
  return `component: "${component}"\n`;
}

// scope: emitted only when --scope is given (D2); absent scope is never an error.
function buildScopeFrontmatterLine(scope) {
  if (!Array.isArray(scope) || scope.length === 0) return "";
  return `scope: [${scope.map((glob) => `"${glob}"`).join(", ")}]\n`;
}

function buildSprintContent({ milestone, started, due, topic, component, scope }) {
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

// Overlap is the one shared scopesOverlap predicate. A scopeless track in a
// multi-track portfolio cannot be proven disjoint — warn-and-allow.
function checkTrackDisjointness({ sprintsDir, component, scope, newTrackFile = "new sprint" }) {
  const activeTracks = listActiveSprintFiles(sprintsDir).map((file) => ({
    file,
    frontmatter: parseFrontmatter(fs.readFileSync(path.join(sprintsDir, file), "utf-8")),
  }));
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
  topic, milestone, component, scope,
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
  if (fileExists(sprintFile)) {
    throw new Error(`Sprint file already exists: ${sprintFile}`);
  }

  const warnings = checkTrackDisjointness({
    sprintsDir, component, scope, newTrackFile: path.basename(sprintFile),
  });

  // `due:` is human-owned (#445): sprint-init never reads GitHub.
  const due = "TBD";
  const content = buildSprintContent({ milestone, started, due, topic, component, scope });
  mkdir(sprintsDir);
  writeFile(sprintFile, content);

  return {
    action: "sprint-init",
    topic,
    milestone,
    sprintFile,
    started,
    due,
    existingFile: false,
    created: true,
    ...(component ? { component } : {}),
    warnings,
    content,
  };
}

function printResult(result) {
  for (const warning of result.warnings || []) {
    console.log(`Warning: ${warning}`);
  }
  console.log("The Plan is empty: add `- [ ] #N Title` items for the work this track carries.");
  console.log(`Created: ${result.sprintFile}\n`);
  console.log(result.content);
}

function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  if (parsed.error) {
    console.log(parsed.error);
    process.exit(1);
  }
  try {
    printResult(createSprintFile(parsed));
  } catch (error) {
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
