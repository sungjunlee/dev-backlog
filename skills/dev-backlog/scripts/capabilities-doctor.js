#!/usr/bin/env node
/**
 * Health check for spec/capabilities.md compactness and Learnings hygiene.
 * This is a structural check only; it does not assess task AC, relay Done
 * Criteria, or capability predicate coverage.
 *
 * Usage: ./scripts/capabilities-doctor.js [--capabilities PATH] [--json] [--strict]
 *
 * Default mode is advisory: report warnings, exit 0. Strict mode exits 1 when
 * hard split triggers or malformed Learnings markers are present.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_CAPABILITIES_PATH = path.join("spec", "capabilities.md");
const DEFAULT_THRESHOLDS = {
  targetCapabilitiesMin: 5,
  targetCapabilitiesMax: 10,
  warnCapabilities: 12,
  hardCapabilities: 15,
  warnLines: 400,
  hardLines: 500,
  warnCapabilityLines: 60,
  hardCapabilityLines: 100,
  maxInlineLearnings: 7,
};

function usage() {
  return "Usage: capabilities-doctor.js [--capabilities PATH] [--json] [--strict]";
}

function parseArgs(args) {
  const options = {
    capabilitiesPath: DEFAULT_CAPABILITIES_PATH,
    json: false,
    strict: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") { options.json = true; continue; }
    if (arg === "--strict") { options.strict = true; continue; }
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
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

function countLines(content) {
  if (content === "") return 0;
  return content.split("\n").length;
}

function parseCapabilityBlocks(content) {
  const lines = content.split("\n");
  const blocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^## Capability:\s+([a-z][a-z0-9-]*)\s*$/);
    if (!match) continue;
    if (current) {
      current.endLine = i;
      current.lines = lines.slice(current.startLine - 1, i);
      blocks.push(current);
    }
    current = { name: match[1], startLine: i + 1, endLine: lines.length, lines: [] };
  }

  if (current) {
    current.lines = lines.slice(current.startLine - 1);
    blocks.push(current);
  }

  return blocks;
}

function analyzeLearnings(blockLines) {
  const beginIndexes = [];
  const endIndexes = [];
  blockLines.forEach((line, index) => {
    if (line.includes("<!-- LEARN:BEGIN -->")) beginIndexes.push(index);
    if (line.includes("<!-- LEARN:END -->")) endIndexes.push(index);
  });

  const hasBegin = beginIndexes.length === 1;
  const hasEnd = endIndexes.length === 1;
  const malformed = !hasBegin || !hasEnd || beginIndexes[0] > endIndexes[0];

  if (malformed) {
    return {
      hasBegin,
      hasEnd,
      learningCount: 0,
      malformed: true,
    };
  }

  const learningLines = blockLines
    .slice(beginIndexes[0] + 1, endIndexes[0])
    .filter((line) => line.trim().startsWith("- "));

  return {
    hasBegin,
    hasEnd,
    learningCount: learningLines.length,
    malformed: false,
  };
}

function analyzeCapability(block, thresholds = DEFAULT_THRESHOLDS) {
  const lineCount = block.lines.length;
  const learnings = analyzeLearnings(block.lines);
  const warnings = [];
  const hardFailures = [];

  if (lineCount > thresholds.warnCapabilityLines) {
    warnings.push(
      `${block.name} is ${lineCount} lines; consider tightening the contract or moving history out of the hot file`,
    );
  }
  if (lineCount > thresholds.hardCapabilityLines) {
    hardFailures.push(
      `${block.name} is ${lineCount} lines; split or compact this capability before it becomes unreadable`,
    );
  }
  if (learnings.learningCount > thresholds.maxInlineLearnings) {
    warnings.push(
      `${block.name} has ${learnings.learningCount} inline Learnings; keep the most recent ${thresholds.maxInlineLearnings} and archive or promote older entries`,
    );
  }
  if (learnings.malformed) {
    hardFailures.push(
      `${block.name} has malformed Learnings markers; append-learnings requires exactly one BEGIN before one END marker`,
    );
  }

  return {
    name: block.name,
    startLine: block.startLine,
    endLine: block.endLine,
    lineCount,
    learningCount: learnings.learningCount,
    hasLearnBegin: learnings.hasBegin,
    hasLearnEnd: learnings.hasEnd,
    warnings,
    hardFailures,
  };
}

function analyzeCapabilities({
  capabilitiesPath = DEFAULT_CAPABILITIES_PATH,
  thresholds = DEFAULT_THRESHOLDS,
  readFile = fs.readFileSync,
  fileExists = fs.existsSync,
} = {}) {
  if (!fileExists(capabilitiesPath)) {
    return {
      found: false,
      structuralOnly: true,
      coverage: "not_assessed",
      capabilitiesPath,
      thresholds,
      lineCount: 0,
      capabilityCount: 0,
      capabilities: [],
      warnings: [],
      hardFailures: [],
      recommendations: [],
    };
  }

  const content = readFile(capabilitiesPath, "utf-8");
  const lineCount = countLines(content);
  const blocks = parseCapabilityBlocks(content);
  const capabilities = blocks.map((block) => analyzeCapability(block, thresholds));
  const warnings = [];
  const hardFailures = [];
  const recommendations = [];

  if (blocks.length > thresholds.warnCapabilities) {
    warnings.push(
      `${blocks.length} capabilities exceeds the ${thresholds.warnCapabilities} soft budget; re-grill to merge adjacent contract surfaces`,
    );
  }
  if (blocks.length > thresholds.hardCapabilities) {
    hardFailures.push(
      `${blocks.length} capabilities exceeds the ${thresholds.hardCapabilities} hard budget; split or regroup before adding more`,
    );
  }
  if (lineCount > thresholds.warnLines) {
    warnings.push(
      `${lineCount} lines exceeds the ${thresholds.warnLines}-line soft budget; compact Learnings or tighten capability text`,
    );
  }
  if (lineCount > thresholds.hardLines) {
    hardFailures.push(
      `${lineCount} lines exceeds the ${thresholds.hardLines}-line split trigger`,
    );
  }

  for (const capability of capabilities) {
    warnings.push(...capability.warnings);
    hardFailures.push(...capability.hardFailures);
  }

  if (hardFailures.length > 0) {
    recommendations.push("Run a compaction pass or migrate to spec/components/<slug>.md before expanding this spec.");
  } else if (warnings.length > 0) {
    recommendations.push("Keep the single file, but tighten capability boundaries before adding more content.");
  } else {
    recommendations.push("Capability spec is within compactness budget.");
  }

  return {
    found: true,
    structuralOnly: true,
    coverage: "not_assessed",
    capabilitiesPath,
    thresholds,
    lineCount,
    capabilityCount: blocks.length,
    capabilities,
    warnings,
    hardFailures,
    recommendations,
  };
}

function hasHardFailures(result) {
  return result.hardFailures.length > 0;
}

function formatReport(result) {
  if (!result.found) {
    return [
      "Structural check only: capability spec hygiene and compactness.",
      "Coverage: not assessed for task AC, relay Done Criteria, or capability predicate coverage.",
      `No spec/capabilities.md at ${result.capabilitiesPath} — nothing to check.`,
    ].join("\n");
  }

  const lines = [
    "Structural check only: capability spec hygiene and compactness.",
    "Coverage: not assessed for task AC, relay Done Criteria, or capability predicate coverage.",
    `Checked ${result.capabilityCount} capability/capabilities across ${result.lineCount} line(s).`,
    `Budget: target ${result.thresholds.targetCapabilitiesMin}-${result.thresholds.targetCapabilitiesMax}, warn >${result.thresholds.warnCapabilities} or >${result.thresholds.warnLines} lines, split >${result.thresholds.hardCapabilities} or >${result.thresholds.hardLines} lines.`,
  ];

  if (result.warnings.length === 0 && result.hardFailures.length === 0) {
    lines.push("Capability spec hygiene is within compactness budget.");
  }

  if (result.warnings.length > 0) {
    lines.push("Warnings:");
    for (const warning of result.warnings) lines.push(`  - ${warning}`);
  }

  if (result.hardFailures.length > 0) {
    lines.push("Hard triggers:");
    for (const failure of result.hardFailures) lines.push(`  - ${failure}`);
  }

  lines.push("Recommendation:");
  for (const recommendation of result.recommendations) lines.push(`  - ${recommendation}`);

  return lines.join("\n");
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) { console.error(parsed.error); process.exit(1); }
  if (parsed.help) { console.log(usage()); return; }

  const result = analyzeCapabilities(parsed);

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatReport(result));
  }

  if (parsed.strict && hasHardFailures(result)) process.exit(1);
}

if (require.main === module) main();

module.exports = {
  DEFAULT_THRESHOLDS,
  parseArgs,
  countLines,
  parseCapabilityBlocks,
  analyzeLearnings,
  analyzeCapability,
  analyzeCapabilities,
  hasHardFailures,
  formatReport,
};
