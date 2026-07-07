#!/usr/bin/env node
/**
 * Verify that every `component:` value referenced by a sprint file resolves
 * to a declared capability in spec/capabilities.md.
 * This is a structural routing-handle check only; it does not assess task AC,
 * relay Done Criteria, or capability coverage.
 *
 * Usage: ./scripts/component-lint.js [--sprints-dir PATH] [--capabilities PATH] [--json]
 *
 * Behavior:
 *   - Reads spec/capabilities.md and collects "## Capability: <slug>" headers.
 *   - For each backlog/sprints/*.md, extracts `component:` from frontmatter.
 *   - Reports sprints whose component value does not match any declared
 *     capability.
 *   - `component:` is one primary routing handle. Comma-separated values fail
 *     with guidance to keep secondary touches in sprint prose.
 *   - Graceful no-op when spec/capabilities.md is absent (skill is opt-in).
 *
 * Exit codes:
 *   0  no errors, or spec/capabilities.md absent
 *   1  one or more component values do not resolve
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_SPRINTS_DIR = path.join("backlog", "sprints");
const DEFAULT_CAPABILITIES_PATH = path.join("spec", "capabilities.md");

function usage() {
  return "Usage: component-lint.js [--sprints-dir PATH] [--capabilities PATH] [--json]";
}

function parseArgs(args) {
  const options = {
    sprintsDir: DEFAULT_SPRINTS_DIR,
    capabilitiesPath: DEFAULT_CAPABILITIES_PATH,
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
    if (arg === "--capabilities") {
      const next = args[i + 1];
      if (!next) return { ...options, error: `Missing value for --capabilities. ${usage()}` };
      options.capabilitiesPath = next; i += 1; continue;
    }
    if (arg.startsWith("--capabilities=")) {
      options.capabilitiesPath = arg.slice("--capabilities=".length); continue;
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

function parseComponentField(frontmatter) {
  if (!frontmatter) return [];
  const match = frontmatter.match(/^component:\s*(.*)$/m);
  if (!match) return [];
  let raw = match[1].trim();
  if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
  if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
  if (raw === "") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSprintComponents(content) {
  return parseComponentField(parseFrontmatter(content));
}

// True when the frontmatter carries a `component:` key at all (including an
// empty `component: ""`). Distinguishes a deliberate empty value from a fully
// omitted field so the doctor can warn only on real omission when
// spec/capabilities.md exists (see B3 / references/spec-fallback.md).
function hasComponentField(content) {
  const frontmatter = parseFrontmatter(content);
  return Boolean(frontmatter) && /^component:/m.test(frontmatter);
}

function parseCapabilityNames(content) {
  const names = new Set();
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^## Capability:\s+([a-z][a-z0-9-]*)\s*$/);
    if (match) names.add(match[1]);
  }
  return names;
}

function listSprintFiles(sprintsDir, { readdir = fs.readdirSync, fileExists = fs.existsSync } = {}) {
  if (!fileExists(sprintsDir)) return [];
  return readdir(sprintsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => path.join(sprintsDir, f))
    .sort();
}

function classifyComponents(components, declared) {
  const errors = [];
  const invalid = [];
  if (components.length === 0) return { errors, invalid };

  if (components.length > 1) {
    invalid.push(
      `multiple component values (${components.join(", ")}); choose one primary capability slug and mention secondary touches in the sprint body`,
    );
    return { errors, invalid };
  }

  const [primary] = components;
  if (!declared.has(primary)) errors.push(primary);
  return { errors, invalid };
}

function findIssues(sprintFiles, declared, { readFile = fs.readFileSync } = {}) {
  const issues = [];
  for (const file of sprintFiles) {
    const content = readFile(file, "utf-8");
    const components = parseSprintComponents(content);
    if (components.length === 0) continue;
    const { errors, invalid } = classifyComponents(components, declared);
    if (errors.length === 0 && invalid.length === 0) continue;
    issues.push({ sprintFile: file, components, unknown: errors, invalid });
  }
  return issues;
}

function parseSprintStatus(content) {
  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) return "";
  const match = frontmatter.match(/^status:\s*["']?([^"'\n]+)["']?\s*$/m);
  return match ? match[1].trim() : "";
}

function countSprintRouting(sprintFiles, { readFile = fs.readFileSync } = {}) {
  const stats = {
    checkedSprintCount: sprintFiles.length,
    routedSprintCount: 0,
    unroutedSprintCount: 0,
    activeSprintCount: 0,
    legacySprintCount: 0,
  };

  for (const file of sprintFiles) {
    const content = readFile(file, "utf-8");
    const components = parseSprintComponents(content);
    if (components.length > 0) stats.routedSprintCount += 1;
    else stats.unroutedSprintCount += 1;

    if (parseSprintStatus(content) === "active") stats.activeSprintCount += 1;
    else stats.legacySprintCount += 1;
  }

  return stats;
}

function lintComponents({
  sprintsDir = DEFAULT_SPRINTS_DIR,
  capabilitiesPath = DEFAULT_CAPABILITIES_PATH,
  readFile = fs.readFileSync,
  fileExists = fs.existsSync,
  readdir = fs.readdirSync,
} = {}) {
  if (!fileExists(capabilitiesPath)) {
    return {
      capabilitiesFound: false,
      structuralOnly: true,
      coverage: "not_assessed",
      capabilitiesPath,
      issues: [],
      sprintCount: 0,
      checkedSprintCount: 0,
      routedSprintCount: 0,
      unroutedSprintCount: 0,
      activeSprintCount: 0,
      legacySprintCount: 0,
      omittedComponentSprints: [],
    };
  }
  const capsContent = readFile(capabilitiesPath, "utf-8");
  const declared = parseCapabilityNames(capsContent);

  const sprintFiles = listSprintFiles(sprintsDir, { readdir, fileExists });
  const routingStats = countSprintRouting(sprintFiles, { readFile });
  const issues = findIssues(sprintFiles, declared, { readFile });
  const omittedComponentSprints = sprintFiles.filter(
    (file) => !hasComponentField(readFile(file, "utf-8")),
  );

  return {
    capabilitiesFound: true,
    structuralOnly: true,
    coverage: "not_assessed",
    capabilitiesPath,
    declaredCapabilities: [...declared].sort(),
    sprintCount: sprintFiles.length,
    ...routingStats,
    issues,
    omittedComponentSprints,
  };
}

function hasErrors(result) {
  return result.issues.some((issue) => issue.unknown.length > 0 || (issue.invalid || []).length > 0);
}

function formatReport(result) {
  if (!result.capabilitiesFound) {
    return [
      "Structural check only: component routing handles.",
      "Coverage: not assessed for task AC, relay Done Criteria, or capability coverage.",
      `No spec/capabilities.md at ${result.capabilitiesPath} — nothing to lint.`,
    ].join("\n");
  }
  const lines = [
    "Structural check only: component routing handles.",
    "Coverage: not assessed for task AC, relay Done Criteria, or capability coverage.",
    `Routing handles checked: ${result.checkedSprintCount ?? result.sprintCount} sprint file(s); routed ${result.routedSprintCount ?? "unknown"}, unrouted ${result.unroutedSprintCount ?? "unknown"}; active ${result.activeSprintCount ?? "unknown"}, legacy ${result.legacySprintCount ?? "unknown"}.`,
    `Declared capability handles: ${result.declaredCapabilities.length}.`,
  ];
  if (result.issues.length === 0) {
    lines.push("All non-empty component routing handles resolve.");
    return lines.join("\n");
  }
  for (const issue of result.issues) {
    lines.push(`  ${issue.sprintFile}`);
    if (issue.unknown.length > 0) {
      lines.push(`    - unknown component(s): ${issue.unknown.join(", ")}`);
    }
    if (issue.invalid.length > 0) {
      for (const invalid of issue.invalid) lines.push(`    - invalid component: ${invalid}`);
    }
  }
  return lines.join("\n");
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) { console.error(parsed.error); process.exit(1); }
  if (parsed.help) { console.log(usage()); return; }

  const result = lintComponents(parsed);

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatReport(result));
  }

  if (result.capabilitiesFound && hasErrors(result)) process.exit(1);
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  parseFrontmatter,
  parseComponentField,
  parseSprintComponents,
  hasComponentField,
  parseCapabilityNames,
  listSprintFiles,
  parseSprintStatus,
  countSprintRouting,
  classifyComponents,
  findIssues,
  lintComponents,
  hasErrors,
  formatReport,
};
