#!/usr/bin/env node
/**
 * Lint spec/charter.md size against the ~5-minute-read property.
 *
 * Usage: ./scripts/check-size.js [--path PATH] [--strict] [--json]
 *
 * Reads spec/charter.md by default, counts words + lines, and
 * prints a summary. Warns above 1000 words (~5 min at 200 wpm) or
 * 80 lines and suggests candidates to collapse (long deferred lists,
 * oversized Decisions rationale).
 *
 * Exit codes:
 *   0  ok or warnings (advisory)
 *   1  --strict and the file exceeds either threshold
 *   2  charter not found
 */

const fs = require("fs");
const path = require("path");

const WORD_LIMIT = 1000;
const LINE_LIMIT = 80;
const WORDS_PER_MINUTE = 200;
const LONG_RATIONALE_CHARS = 140;
const DEFAULT_CHARTER_PATH = path.join("spec", "charter.md");

function usage() {
  return "Usage: check-size.js [--path PATH] [--strict] [--json]";
}

function parseArgs(args) {
  const options = { charterPath: DEFAULT_CHARTER_PATH, strict: false, json: false };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--strict") { options.strict = true; continue; }
    if (arg === "--json")   { options.json = true;   continue; }
    if (arg === "--help" || arg === "-h") {
      return { ...options, help: true };
    }
    if (arg === "--path") {
      const next = args[i + 1];
      if (!next) return { ...options, error: `Missing value for --path. ${usage()}` };
      options.charterPath = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--path=")) {
      options.charterPath = arg.slice("--path=".length);
      continue;
    }
    return { ...options, error: `Unknown argument: ${arg}. ${usage()}` };
  }

  return options;
}

function stripFrontmatter(content) {
  if (!content.startsWith("---\n")) return content;
  const end = content.indexOf("\n---\n", 4);
  if (end === -1) return content;
  return content.slice(end + 5);
}

function countWords(body) {
  const cleaned = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_|\-]+/g, " ");

  const tokens = cleaned.split(/\s+/).filter((t) => /\w/.test(t));
  return tokens.length;
}

function countLines(content) {
  if (content.length === 0) return 0;
  const trimmed = content.endsWith("\n") ? content.slice(0, -1) : content;
  return trimmed.split("\n").length;
}

function findDeferredObjectives(content) {
  const lines = content.split("\n");
  const deferred = [];
  for (const line of lines) {
    const match = line.match(/^- (O\d+) \[deferred\]/);
    if (match) deferred.push(match[1]);
  }
  return deferred;
}

function findLongDecisionsRationale(content) {
  const offenders = [];
  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.startsWith("|") || !line.includes("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 5) continue;
    const date = cells[1];
    const rationale = cells[3];
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && rationale.length > LONG_RATIONALE_CHARS) {
      offenders.push({ date, rationaleLength: rationale.length });
    }
  }
  return offenders;
}

function buildSuggestions({ deferredIds, longRationale, wordCount, lineCount }) {
  const suggestions = [];

  if (deferredIds.length >= 3) {
    suggestions.push(
      `Collapse ${deferredIds.length} deferred objectives (${deferredIds.join(", ")}) into a one-line "(see follow-up specs)" reference.`,
    );
  }

  if (longRationale.length > 0) {
    const dates = longRationale.map((r) => r.date).join(", ");
    suggestions.push(
      `Tighten Decisions rationale for ${dates} (> ${LONG_RATIONALE_CHARS} chars). Move long rationale to PR descriptions or follow-up specs.`,
    );
  }

  if (wordCount > WORD_LIMIT && suggestions.length === 0) {
    suggestions.push(
      "Move operational HOW-knowledge to _context.md; the charter should answer 'what good looks like,' not 'how to do it.'",
    );
  }

  if (lineCount > LINE_LIMIT && suggestions.length === 0) {
    suggestions.push(
      "Consider collapsing related Non-Goals or merging adjacent deferred objectives to reduce line count.",
    );
  }

  return suggestions;
}

function analyze(content) {
  const body = stripFrontmatter(content);
  const wordCount = countWords(body);
  const lineCount = countLines(content);
  const readMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  const deferredIds = findDeferredObjectives(body);
  const longRationale = findLongDecisionsRationale(body);
  const overWords = wordCount > WORD_LIMIT;
  const overLines = lineCount > LINE_LIMIT;
  const exceeded = overWords || overLines;

  return {
    wordCount,
    lineCount,
    readMinutes,
    overWords,
    overLines,
    exceeded,
    deferredIds,
    longRationale,
    suggestions: buildSuggestions({ deferredIds, longRationale, wordCount, lineCount }),
    thresholds: { words: WORD_LIMIT, lines: LINE_LIMIT },
  };
}

function formatSummary(result) {
  const status = result.exceeded ? "⚠" : "✓";
  return `CHARTER: ${result.wordCount} words / ${result.lineCount} lines / ~${result.readMinutes} min ${status}`;
}

function formatWarnings(result) {
  const lines = [];
  if (result.overWords) {
    lines.push(`  - Over word budget: ${result.wordCount} > ${WORD_LIMIT} (~5 min at ${WORDS_PER_MINUTE} wpm)`);
  }
  if (result.overLines) {
    lines.push(`  - Over line budget: ${result.lineCount} > ${LINE_LIMIT}`);
  }
  if (result.suggestions.length > 0) {
    lines.push("Suggestions:");
    for (const s of result.suggestions) lines.push(`  - ${s}`);
  }
  return lines.join("\n");
}

function checkSize({
  charterPath = DEFAULT_CHARTER_PATH,
  readFile = fs.readFileSync,
  fileExists = fs.existsSync,
} = {}) {
  const resolved = path.resolve(charterPath);
  if (!fileExists(resolved)) {
    return { found: false, charterPath: resolved };
  }
  const content = readFile(resolved, "utf-8");
  const result = analyze(content);
  return { found: true, charterPath: resolved, ...result };
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(parsed.error);
    process.exit(1);
  }
  if (parsed.help) {
    console.log(usage());
    return;
  }

  const result = checkSize({ charterPath: parsed.charterPath });

  if (!result.found) {
    if (parsed.json) {
      console.log(JSON.stringify({ found: false, charterPath: result.charterPath }, null, 2));
    } else {
      console.error(`charter not found at ${result.charterPath}`);
    }
    process.exit(2);
  }

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatSummary(result));
    if (result.exceeded || result.suggestions.length > 0) {
      const warnings = formatWarnings(result);
      if (warnings) console.log(warnings);
    }
  }

  if (parsed.strict && result.exceeded) process.exit(1);
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  stripFrontmatter,
  countWords,
  countLines,
  findDeferredObjectives,
  findLongDecisionsRationale,
  buildSuggestions,
  analyze,
  checkSize,
  formatSummary,
  formatWarnings,
};
