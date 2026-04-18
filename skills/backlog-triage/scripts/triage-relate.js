#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { readTriageConfig } = require("../../dev-backlog/scripts/lib");

const DEFAULT_CONFIG_PATH = path.join("backlog", "triage-config.yml");

function parseArgs(args) {
  const options = {
    snapshotPath: undefined,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--snapshot") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { ...options, error: "Missing value for --snapshot. Expected a snapshot JSON path." };
      }
      options.snapshotPath = nextValue;
      index += 1;
      continue;
    }

    if (arg.startsWith("--snapshot=")) {
      options.snapshotPath = arg.slice("--snapshot=".length);
      continue;
    }

    return { ...options, error: `Unknown argument: ${arg}` };
  }

  if (!options.snapshotPath) {
    return {
      ...options,
      error: "Missing required --snapshot PATH. Usage: triage-relate.js --snapshot PATH [--json]",
    };
  }

  return options;
}

function maskFencedCodeBlocks(text) {
  const source = typeof text === "string" ? text : "";
  const parts = source.split(/(\r?\n)/);
  let inFence = false;
  let fenceChar = "";
  let output = "";

  for (const part of parts) {
    if (part === "\n" || part === "\r\n") {
      output += part;
      continue;
    }

    const fenceMatch = part.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const nextFenceChar = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = nextFenceChar;
      } else if (nextFenceChar === fenceChar) {
        inFence = false;
        fenceChar = "";
      }
      output += part.replace(/[^\r\n]/g, " ");
      continue;
    }

    output += inFence ? part.replace(/[^\r\n]/g, " ") : part;
  }

  return output;
}

function getTokenBounds(text, index) {
  let start = index;
  let end = index;

  while (start > 0 && !/\s/.test(text[start - 1])) start -= 1;
  while (end < text.length && !/\s/.test(text[end])) end += 1;

  return { start, end };
}

function isIssueRefInUrlToken(text, hashIndex) {
  const { start, end } = getTokenBounds(text, hashIndex);
  const token = text.slice(start, end);
  const relativeIndex = hashIndex - start;
  const beforeHash = token.slice(0, relativeIndex);

  return (
    /(?:https?:\/\/|www\.|[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i.test(beforeHash) ||
    beforeHash.includes("/")
  );
}

function normalizeSnippet(snippet) {
  return snippet.replace(/\s+/g, " ").trim();
}

function extractSnippet(text, start, end) {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = text.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  const line = text.slice(lineStart, lineEnd);
  const startInLine = Math.max(0, start - lineStart);
  const endInLine = Math.min(line.length, end - lineStart);

  const sentenceStartOffset = Math.max(
    line.lastIndexOf(". ", startInLine - 1),
    line.lastIndexOf("! ", startInLine - 1),
    line.lastIndexOf("? ", startInLine - 1)
  );
  const sentenceStart = sentenceStartOffset === -1 ? 0 : sentenceStartOffset + 2;

  const sentenceEndCandidates = [line.indexOf(". ", endInLine), line.indexOf("! ", endInLine), line.indexOf("? ", endInLine)]
    .filter((value) => value !== -1)
    .sort((left, right) => left - right);
  const sentenceEnd = sentenceEndCandidates.length === 0 ? line.length : sentenceEndCandidates[0] + 1;

  return normalizeSnippet(line.slice(sentenceStart, sentenceEnd));
}

function extractIssueRefs(text) {
  const source = typeof text === "string" ? text : "";
  const masked = maskFencedCodeBlocks(source);
  const refs = [];
  const pattern = /(^|[^A-Za-z0-9_])#(\d+)\b/g;

  let match;
  while ((match = pattern.exec(masked)) !== null) {
    const hashIndex = match.index + match[1].length;
    if (isIssueRefInUrlToken(masked, hashIndex)) continue;

    refs.push({
      number: Number(match[2]),
      match: `#${match[2]}`,
      index: hashIndex,
      end: hashIndex + match[2].length + 1,
      snippet: extractSnippet(source, hashIndex, hashIndex + match[2].length + 1),
    });
  }

  return refs;
}

function makeEdge({ from, to, kind, confidence, evidence }) {
  return { from, to, kind, confidence, evidence };
}

function dedupeEdges(edges) {
  const seen = new Set();
  return edges.filter((edge) => {
    const key = `${edge.from}:${edge.to}:${edge.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function snapshotIssueNumbers(snapshot) {
  return new Set(snapshot.issues.map((issue) => issue.number));
}

function scanMentions(snapshot) {
  const edges = [];
  const openNumbers = snapshotIssueNumbers(snapshot);

  for (const issue of snapshot.issues) {
    for (const ref of extractIssueRefs(issue.body)) {
      if (issue.number === ref.number) continue;
      if (!openNumbers.has(ref.number)) continue;
      edges.push(
        makeEdge({
          from: issue.number,
          to: ref.number,
          kind: "mentions",
          confidence: 0.75,
          evidence: {
            match: ref.match,
            snippet: ref.snippet,
          },
        })
      );
    }
  }

  return dedupeEdges(edges);
}

function scanPhraseEdges(snapshot, patterns, kind, confidence) {
  const edges = [];
  const openNumbers = snapshotIssueNumbers(snapshot);

  for (const issue of snapshot.issues) {
    const source = typeof issue.body === "string" ? issue.body : "";
    const masked = maskFencedCodeBlocks(source);

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(masked)) !== null) {
        const phraseIndex = match.index;
        const hashIndex = masked.indexOf("#", phraseIndex);
        if (hashIndex === -1 || isIssueRefInUrlToken(masked, hashIndex)) continue;

        const target = Number(match[1]);
        if (issue.number === target) continue;
        if (!openNumbers.has(target)) continue;

        edges.push(
          makeEdge({
            from: issue.number,
            to: target,
            kind,
            confidence,
            evidence: {
              phrase: normalizeSnippet(match[0]),
              snippet: extractSnippet(source, phraseIndex, phraseIndex + match[0].length),
            },
          })
        );
      }
      pattern.lastIndex = 0;
    }
  }

  return dedupeEdges(edges);
}

function scanBlocks(snapshot) {
  return scanPhraseEdges(snapshot, [/\bblocks\s+#(\d+)\b/gi, /\bcloses\s+#(\d+)\b/gi], "blocks", 1);
}

function scanDependsOn(snapshot) {
  return scanPhraseEdges(
    snapshot,
    [/\bblocked by\s+#(\d+)\b/gi, /\bdepends(?:\s+on|-on)\s+#(\d+)\b/gi],
    "depends-on",
    1
  );
}

function tokenizeTitle(title) {
  return new Set(
    String(title || "")
      .toLowerCase()
      .match(/[a-z0-9]+/g)?.filter((token) => token.length > 1) || []
  );
}

function jaccardSimilarity(left, right) {
  const leftTokens = [...left];
  const rightTokens = [...right];
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return { score: 0, overlap: [] };

  const overlap = leftTokens.filter((token) => right.has(token));
  return {
    score: overlap.length / union.size,
    overlap,
  };
}

function findDuplicateCandidates(snapshot, config = readTriageConfig("backlog")) {
  const threshold = Number(config.duplicate_threshold) || 0;
  const edges = [];

  for (let index = 0; index < snapshot.issues.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < snapshot.issues.length; otherIndex += 1) {
      const left = snapshot.issues[index];
      const right = snapshot.issues[otherIndex];
      const similarity = jaccardSimilarity(tokenizeTitle(left.title), tokenizeTitle(right.title));

      if (similarity.score < threshold || similarity.overlap.length === 0) continue;

      const from = Math.min(left.number, right.number);
      const to = Math.max(left.number, right.number);
      const fromIssue = from === left.number ? left : right;
      const toIssue = to === right.number ? right : left;

      edges.push(
        makeEdge({
          from,
          to,
          kind: "duplicate-candidate",
          confidence: similarity.score,
          evidence: {
            score: Number(similarity.score.toFixed(4)),
            overlap: similarity.overlap.sort(),
            titles: {
              from: fromIssue.title,
              to: toIssue.title,
            },
          },
        })
      );
    }
  }

  return dedupeEdges(edges);
}

function compareEdges(left, right) {
  return left.from - right.from || left.to - right.to || left.kind.localeCompare(right.kind);
}

function sortEdges(edges) {
  return [...edges].sort(compareEdges);
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Invalid snapshot JSON: expected a top-level object.");
  }

  if (!Array.isArray(snapshot.issues)) {
    throw new Error("Invalid snapshot JSON: expected an issues array.");
  }

  for (const issue of snapshot.issues) {
    if (!Number.isInteger(issue?.number)) {
      throw new Error("Invalid snapshot JSON: each issue must include an integer number.");
    }
    if (typeof issue?.title !== "string") {
      throw new Error(`Invalid snapshot JSON: issue #${issue.number} is missing a string title.`);
    }
    if (typeof issue?.body !== "string") {
      throw new Error(`Invalid snapshot JSON: issue #${issue.number} is missing a string body.`);
    }
  }

  return snapshot;
}

function readSnapshotFile(snapshotPath) {
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot file is missing or unreadable: ${snapshotPath}`);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(snapshotPath, "utf-8"));
    return validateSnapshot(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Malformed snapshot JSON at ${snapshotPath}: ${error.message}`);
    }
    throw error;
  }
}

function resolveBacklogDir(snapshot) {
  const configPath =
    typeof snapshot.config_path === "string" && snapshot.config_path.trim()
      ? snapshot.config_path
      : DEFAULT_CONFIG_PATH;
  const backlogDir = path.dirname(configPath);
  return backlogDir === "." ? "backlog" : backlogDir;
}

function analyzeSnapshot(snapshot, { config = readTriageConfig(resolveBacklogDir(snapshot)) } = {}) {
  return sortEdges([
    ...scanMentions(snapshot),
    ...scanBlocks(snapshot),
    ...scanDependsOn(snapshot),
    ...findDuplicateCandidates(snapshot, config),
  ]);
}

function formatEdge(edge) {
  if (edge.kind === "duplicate-candidate") {
    return `#${edge.from} ${edge.kind} #${edge.to} (${edge.confidence.toFixed(2)}) ${edge.evidence.titles.from} <> ${edge.evidence.titles.to}`;
  }

  const snippet = typeof edge.evidence === "object" ? edge.evidence.snippet || edge.evidence.phrase : edge.evidence;
  return `#${edge.from} ${edge.kind} #${edge.to} ${snippet}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.error) {
    console.error(options.error);
    process.exit(1);
  }

  let edges;
  try {
    const snapshot = readSnapshotFile(options.snapshotPath);
    edges = analyzeSnapshot(snapshot);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify({ edges }, null, 2));
    return;
  }

  if (edges.length === 0) {
    console.log("No relationships found.");
    return;
  }

  for (const edge of edges) {
    console.log(formatEdge(edge));
  }
}

if (require.main === module) main();

module.exports = {
  parseArgs,
  maskFencedCodeBlocks,
  extractIssueRefs,
  scanMentions,
  scanBlocks,
  scanDependsOn,
  findDuplicateCandidates,
  readSnapshotFile,
  analyzeSnapshot,
  sortEdges,
  resolveBacklogDir,
};
