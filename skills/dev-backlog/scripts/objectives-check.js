#!/usr/bin/env node
/**
 * Verify that every `objectives:` ID referenced by a sprint file still
 * exists in spec/charter.md with an actionable status.
 *
 * Usage: ./scripts/objectives-check.js [--sprints-dir PATH] [--charter PATH] [--json]
 *
 * Reports two drift classes per sprint:
 *   - missing  : the ID is not in the charter at all (removed; IDs are never reused)
 *   - deferred : the ID exists but is marked [deferred]; sprints should not target
 *                deferred objectives
 * Charter objective lines may be status-free (`- O10 — ...`, targetable) or carry
 * a legacy status of [validated], [active], [implemented], or [deferred];
 * only [deferred] objectives are not targetable by sprints.
 * Sprints with `status: completed` are immutable history and are skipped:
 * a retired charter ID referenced only by completed sprints is not drift.
 *
 * Graceful no-op when spec/charter.md and legacy CHARTER.md are absent.
 *
 * Exit codes:
 *   0  no drift found, or charter absent
 *   1  drift found (missing or deferred IDs referenced)
 */

const fs = require("fs");
const path = require("path");
const {
  CANONICAL_CHARTER_PATH,
  resolveCharterPath,
} = require("./spec-paths.js");
const { toPortablePath } = require("./portable-path.js");
const { parseSprintStatus } = require("./sprint-status.js");

const DEFAULT_SPRINTS_DIR = path.join("backlog", "sprints");

function usage() {
  return "Usage: objectives-check.js [--sprints-dir PATH] [--charter PATH] [--json]";
}

function parseArgs(args) {
  const options = {
    sprintsDir: DEFAULT_SPRINTS_DIR,
    charterPath: null,
    json: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") { options.json = true; continue; }
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
    if (arg === "--sprints-dir") {
      const next = args[i + 1];
      if (!next) return { ...options, error: `Missing value for --sprints-dir. ${usage()}` };
      options.sprintsDir = next; i += 1; continue;
    }
    if (arg.startsWith("--sprints-dir=")) {
      options.sprintsDir = arg.slice("--sprints-dir=".length); continue;
    }
    if (arg === "--charter") {
      const next = args[i + 1];
      if (!next) return { ...options, error: `Missing value for --charter. ${usage()}` };
      options.charterPath = next; i += 1; continue;
    }
    if (arg.startsWith("--charter=")) {
      options.charterPath = arg.slice("--charter=".length); continue;
    }
    return { ...options, error: `Unknown argument: ${arg}. ${usage()}` };
  }

  return options;
}

function parseFrontmatter(content) {
  if (!content.startsWith("---\n")) return null;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return null;
  return content.slice(4, end);
}

function extractObjectivesField(frontmatter) {
  if (!frontmatter) return [];
  const match = frontmatter.match(/^objectives:\s*\[([^\]]*)\]/m);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^O\d+$/.test(s));
}

function parseSprintObjectives(content) {
  return extractObjectivesField(parseFrontmatter(content));
}

// True when the frontmatter carries an `objectives:` key at all (including an
// empty `objectives: []`). Distinguishes a deliberate empty value from a fully
// omitted field so the doctor can warn only on real omission when a charter
// exists (see B3 / references/spec-fallback.md).
function hasObjectivesField(content) {
  const frontmatter = parseFrontmatter(content);
  return Boolean(frontmatter) && /^objectives:/m.test(frontmatter);
}

// Two explicit objective-line forms, nothing in between:
//   legacy: `- O3 [active] predicate ...`  (known statuses only)
//   lean:   `- O10 — predicate ...`        (status-free, em-dash separator)
// Bare IDs (`- O10 prose`), unknown statuses (`- O10 [bogus]`), and malformed
// spacing (`- O10 [deferred]later`) do not parse — a drift check must not
// guess. IDs are never reused, so on a duplicate ID the first line wins;
// a later contradictory line cannot silently flip e.g. deferred → targetable.
const LEGACY_OBJECTIVE_RE = /^- (O\d+) \[(validated|active|implemented|deferred)\](?: |$)/;
const LEAN_OBJECTIVE_RE = /^- (O\d+) — \S/;

function parseCharterObjectives(content) {
  const objectives = new Map();
  const lines = content.split("\n");
  for (const line of lines) {
    const legacy = line.match(LEGACY_OBJECTIVE_RE);
    if (legacy) {
      if (!objectives.has(legacy[1])) objectives.set(legacy[1], legacy[2]);
      continue;
    }
    const lean = line.match(LEAN_OBJECTIVE_RE);
    // A status-free lean line is targetable; record it as "listed".
    if (lean && !objectives.has(lean[1])) objectives.set(lean[1], "listed");
  }
  return objectives;
}

function listSprintFiles(sprintsDir, { readdir = fs.readdirSync, fileExists = fs.existsSync } = {}) {
  if (!fileExists(sprintsDir)) return [];
  return readdir(sprintsDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(sprintsDir, f))
    .sort();
}

function findDrift(sprintFiles, charterObjectives, { readFile = fs.readFileSync } = {}) {
  const drift = [];
  for (const file of sprintFiles) {
    const content = readFile(file, "utf-8");
    // Completed sprints are immutable history; their references may point at
    // since-retired charter IDs without constituting drift.
    if (parseSprintStatus(content) === "completed") continue;
    const ids = parseSprintObjectives(content);
    const missing = [];
    const deferred = [];
    for (const id of ids) {
      const status = charterObjectives.get(id);
      if (status === undefined) missing.push(id);
      else if (status === "deferred") deferred.push(id);
    }
    if (missing.length > 0 || deferred.length > 0) {
      drift.push({ sprintFile: file, missing, deferred });
    }
  }
  return drift;
}

function checkObjectives({
  sprintsDir = DEFAULT_SPRINTS_DIR,
  charterPath = null,
  repoRoot = process.cwd(),
  readFile = fs.readFileSync,
  fileExists = fs.existsSync,
  readdir = fs.readdirSync,
} = {}) {
  const resolved = resolveCharterPath({ repoRoot, charterPath, fileExists });
  if (!resolved.found) {
    return {
      charterFound: false,
      charterPath: toPortablePath(resolved.charterPath),
      charterSource: resolved.source,
      checkedPaths: resolved.checkedPaths.map(toPortablePath),
      drift: [],
      sprintCount: 0,
      omittedObjectiveSprints: [],
    };
  }
  const charterContent = readFile(resolved.charterPath, "utf-8");
  const charterObjectives = parseCharterObjectives(charterContent);

  const sprintFiles = listSprintFiles(sprintsDir, { readdir, fileExists });
  const drift = findDrift(sprintFiles, charterObjectives, { readFile });
  const omittedObjectiveSprints = sprintFiles.filter(
    (file) => !hasObjectivesField(readFile(file, "utf-8")),
  );

  return {
    charterFound: true,
    charterPath: toPortablePath(resolved.charterPath),
    charterSource: resolved.source,
    checkedPaths: resolved.checkedPaths.map(toPortablePath),
    charterObjectiveIds: [...charterObjectives.keys()].sort(),
    sprintCount: sprintFiles.length,
    drift: drift.map((entry) => ({
      ...entry,
      sprintFile: toPortablePath(entry.sprintFile),
    })),
    omittedObjectiveSprints: omittedObjectiveSprints.map(toPortablePath),
  };
}

function formatReport(result) {
  if (!result.charterFound) {
    return `No ${CANONICAL_CHARTER_PATH} or legacy CHARTER.md found — nothing to check.`;
  }
  const lines = [
    `Checked ${result.sprintCount} sprint file(s) against ${result.charterObjectiveIds.length} charter objective(s) from ${result.charterPath}.`,
  ];
  if (result.drift.length === 0) {
    lines.push("No drift detected ✓");
    return lines.join("\n");
  }
  lines.push(`Drift detected ⚠ (${result.drift.length} sprint file(s)):`);
  for (const d of result.drift) {
    lines.push(`  ${d.sprintFile}`);
    if (d.missing.length > 0) lines.push(`    - missing: ${d.missing.join(", ")}`);
    if (d.deferred.length > 0) lines.push(`    - deferred: ${d.deferred.join(", ")}`);
  }
  return lines.join("\n");
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) { console.error(parsed.error); process.exit(1); }
  if (parsed.help) { console.log(usage()); return; }

  const result = checkObjectives(parsed);

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatReport(result));
  }

  if (result.charterFound && result.drift.length > 0) process.exit(1);
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  parseFrontmatter,
  extractObjectivesField,
  parseSprintObjectives,
  hasObjectivesField,
  parseCharterObjectives,
  parseSprintStatus,
  resolveCharterPath,
  listSprintFiles,
  findDrift,
  checkObjectives,
  formatReport,
};
