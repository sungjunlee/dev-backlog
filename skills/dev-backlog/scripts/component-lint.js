#!/usr/bin/env node
/**
 * Verify that every `component:` value referenced by a sprint file resolves
 * to a declared capability in spec/capabilities.md.
 *
 * Usage: ./scripts/component-lint.js [--sprints-dir PATH] [--capabilities PATH] [--json]
 *
 * Behavior:
 *   - Reads spec/capabilities.md and collects "## Capability: <name>" headers.
 *   - For each backlog/sprints/*.md, extracts `component:` from frontmatter.
 *   - Reports sprints whose component value (single or comma-separated multi)
 *     does not match any declared capability.
 *   - Per design doc D4: multi-component values use first-declared + warn.
 *     The first value must resolve; subsequent values are flagged as warnings,
 *     not errors.
 *   - Graceful no-op when spec/capabilities.md is absent (skill is opt-in).
 *
 * Exit codes:
 *   0  no errors (warnings OK), or spec/capabilities.md absent
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

function parseCapabilityNames(content) {
  const names = new Set();
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^## Capability:\s+(\S+)/);
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
  const warnings = [];
  if (components.length === 0) return { errors, warnings };

  const [primary, ...rest] = components;
  if (!declared.has(primary)) errors.push(primary);
  for (const extra of rest) {
    if (!declared.has(extra)) {
      errors.push(extra);
    } else {
      warnings.push(extra);
    }
  }
  return { errors, warnings };
}

function findIssues(sprintFiles, declared, { readFile = fs.readFileSync } = {}) {
  const issues = [];
  for (const file of sprintFiles) {
    const content = readFile(file, "utf-8");
    const components = parseSprintComponents(content);
    if (components.length === 0) continue;
    const { errors, warnings } = classifyComponents(components, declared);
    if (errors.length === 0 && warnings.length === 0) continue;
    issues.push({ sprintFile: file, components, unknown: errors, secondary: warnings });
  }
  return issues;
}

function lintComponents({
  sprintsDir = DEFAULT_SPRINTS_DIR,
  capabilitiesPath = DEFAULT_CAPABILITIES_PATH,
  readFile = fs.readFileSync,
  fileExists = fs.existsSync,
  readdir = fs.readdirSync,
} = {}) {
  if (!fileExists(capabilitiesPath)) {
    return { capabilitiesFound: false, capabilitiesPath, issues: [], sprintCount: 0 };
  }
  const capsContent = readFile(capabilitiesPath, "utf-8");
  const declared = parseCapabilityNames(capsContent);

  const sprintFiles = listSprintFiles(sprintsDir, { readdir, fileExists });
  const issues = findIssues(sprintFiles, declared, { readFile });

  return {
    capabilitiesFound: true,
    capabilitiesPath,
    declaredCapabilities: [...declared].sort(),
    sprintCount: sprintFiles.length,
    issues,
  };
}

function hasErrors(result) {
  return result.issues.some((issue) => issue.unknown.length > 0);
}

function formatReport(result) {
  if (!result.capabilitiesFound) {
    return `No spec/capabilities.md at ${result.capabilitiesPath} — nothing to lint.`;
  }
  const lines = [
    `Linted ${result.sprintCount} sprint file(s) against ${result.declaredCapabilities.length} declared capability/capabilities.`,
  ];
  if (result.issues.length === 0) {
    lines.push("All component values resolve ✓");
    return lines.join("\n");
  }
  for (const issue of result.issues) {
    lines.push(`  ${issue.sprintFile}`);
    if (issue.unknown.length > 0) {
      lines.push(`    - unknown component(s): ${issue.unknown.join(", ")}`);
    }
    if (issue.secondary.length > 0) {
      lines.push(`    - warning: secondary component(s) ignored per D4 (first-wins): ${issue.secondary.join(", ")}`);
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
  parseCapabilityNames,
  listSprintFiles,
  classifyComponents,
  findIssues,
  lintComponents,
  hasErrors,
  formatReport,
};
