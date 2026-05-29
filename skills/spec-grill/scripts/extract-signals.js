#!/usr/bin/env node
/**
 * Brownfield bootstrap for spec/capabilities.md.
 *
 * Usage: ./scripts/extract-signals.js [--repo-root PATH] [--commit-limit N] [--dry-run] [--json]
 *
 * Reads repo signals and reports raw capability seeds that
 * grill mode can interview against. Does not write spec/capabilities.md —
 * grill mode owns admission, merging, splitting, and naming.
 *
 * Signal authority:
 *   - README.md / spec/charter.md — product authority
 *   - Top-level source dirs     — repo-structure evidence
 *   - CLAUDE.md / AGENTS.md     — development-harness conventions
 *   - Last N commit messages    — history
 *
 * Output: JSON of shape
 *   {
 *     signal_authority: [{ signal, authority, found, note }],
 *     capabilities: [{ name, signals, candidate_goal, candidate_scope }]
 *   }
 *
 * Same inputs produce the same draft (deterministic ordering).
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  CANONICAL_CHARTER_PATH,
  LEGACY_CHARTER_PATH,
  resolveCharterPath,
} = require("../../dev-backlog/scripts/spec-paths.js");

const SOURCE_ROOT_CANDIDATES = ["src", "lib", "app", "packages", "skills"];
const SUMMARY_DIR_LIMIT = 5;
const DEFAULT_COMMIT_LIMIT = 100;

function buildSignalAuthority({ readmeFound, charterFound, charterSource, harnessFiles, sourceRoot, commitsScanned }) {
  return [
    {
      signal: "README.md",
      authority: "product",
      found: readmeFound,
      note: "User-facing product framing; can seed Problem, Approach, and capability goals.",
    },
    {
      signal: "spec/charter.md",
      authority: "product",
      found: charterFound,
      note: charterSource === "legacy"
        ? "Accepted project axis found through legacy root CHARTER.md fallback; migrate to spec/charter.md."
        : "Accepted project axis; Objectives can constrain capability candidates.",
    },
    {
      signal: "CLAUDE.md/AGENTS.md",
      authority: "development-harness",
      found: harnessFiles.length > 0,
      note: "Agent workflow and repo conventions; does not create product capability boundaries by itself.",
    },
    {
      signal: sourceRoot ? `${sourceRoot.name}/` : "source root",
      authority: "repo-structure",
      found: sourceRoot !== null,
      note: "Code organization evidence; useful as raw candidate surface, not final capability authority.",
    },
    {
      signal: "git commit scopes",
      authority: "history",
      found: commitsScanned > 0,
      note: "Recent work history; clusters usage but does not override accepted specs.",
    },
  ];
}

function usage() {
  return "Usage: extract-signals.js [--repo-root PATH] [--commit-limit N] [--dry-run] [--json]";
}

function parseArgs(args) {
  const options = {
    repoRoot: ".",
    commitLimit: DEFAULT_COMMIT_LIMIT,
    dryRun: false,
    json: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--dry-run") { options.dryRun = true; continue; }
    if (arg === "--json")    { options.json = true;   continue; }
    if (arg === "--help" || arg === "-h") return { ...options, help: true };

    if (arg === "--repo-root") {
      const next = args[i + 1];
      if (!next) return { ...options, error: `Missing value for --repo-root. ${usage()}` };
      options.repoRoot = next; i += 1; continue;
    }
    if (arg.startsWith("--repo-root=")) {
      options.repoRoot = arg.slice("--repo-root=".length); continue;
    }
    if (arg === "--commit-limit") {
      const next = args[i + 1];
      if (!next || !/^\d+$/.test(next)) {
        return { ...options, error: `--commit-limit expects a positive integer. ${usage()}` };
      }
      options.commitLimit = Number(next); i += 1; continue;
    }
    if (arg.startsWith("--commit-limit=")) {
      const raw = arg.slice("--commit-limit=".length);
      if (!/^\d+$/.test(raw)) {
        return { ...options, error: `--commit-limit expects a positive integer. ${usage()}` };
      }
      options.commitLimit = Number(raw); continue;
    }
    return { ...options, error: `Unknown argument: ${arg}. ${usage()}` };
  }

  return options;
}

function detectSourceRoot(repoRoot, { fileExists = fs.existsSync, statSync = fs.statSync } = {}) {
  for (const candidate of SOURCE_ROOT_CANDIDATES) {
    const candidatePath = path.join(repoRoot, candidate);
    if (fileExists(candidatePath) && statSync(candidatePath).isDirectory()) {
      return { name: candidate, path: candidatePath };
    }
  }
  return null;
}

function listCapabilityCandidates(sourceRoot, { readdir = fs.readdirSync, statSync = fs.statSync } = {}) {
  if (!sourceRoot) return [];
  return readdir(sourceRoot.path)
    .filter((entry) => {
      if (entry.startsWith(".") || entry.startsWith("_")) return false;
      try {
        return statSync(path.join(sourceRoot.path, entry)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function extractCommitScopes(commitMessages) {
  const scopes = new Map();
  for (const message of commitMessages) {
    const match = message.match(/^[a-z]+\(([a-z][\w.\-,/ ]*)\)[!:]/);
    if (!match) continue;
    for (const raw of match[1].split(",")) {
      const scope = raw.trim();
      if (!scope) continue;
      scopes.set(scope, (scopes.get(scope) || 0) + 1);
    }
  }
  return scopes;
}

function getRecentCommitMessages(repoRoot, limit, { exec = execFileSync } = {}) {
  try {
    const out = exec(
      "git",
      ["-C", repoRoot, "log", `-n`, String(limit), "--pretty=%s"],
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function readOptionalFile(filePath, { readFile = fs.readFileSync, fileExists = fs.existsSync } = {}) {
  if (!fileExists(filePath)) return null;
  try {
    return readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

function resolveCharterFile(repoRoot, deps = {}) {
  const resolved = resolveCharterPath({ repoRoot, fileExists: deps.fileExists });
  if (!resolved.found) {
    return { found: false, path: resolved.charterPath, source: resolved.source, content: null };
  }
  return {
    found: true,
    path: resolved.charterPath,
    source: resolved.source,
    content: readOptionalFile(resolved.charterPath, deps),
  };
}

function readCharterObjectives(repoRoot, deps = {}) {
  const charter = resolveCharterFile(repoRoot, deps);
  if (!charter.content) return [];
  const objectives = [];
  for (const line of charter.content.split("\n")) {
    const match = line.match(/^- (O\d+) \[(validated|active|deferred)\]\s+(.*?)(?:\s+·\s+src:|\s*$)/);
    if (match) {
      objectives.push({ id: match[1], status: match[2], predicate: match[3].trim() });
    }
  }
  return objectives;
}

function summarizeReadme(readme) {
  if (!readme) return null;
  for (const line of readme.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("[!")) continue;
    if (trimmed.startsWith("<!--")) continue;
    if (/^<\/?div\b/i.test(trimmed)) continue;
    if (/^<p\b/i.test(trimmed) || /^<\/p>/i.test(trimmed)) continue;
    if (/^<br\s*\/?>$/i.test(trimmed)) continue;
    if (/^\[.+\]\(.+\)(\s*[•|·]\s*\[.+\]\(.+\))*$/.test(trimmed)) continue;
    return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
  }
  return null;
}

function buildCapability({ name, sourceRootName, signals, readmeSummary, charterObjectives }) {
  const directorySignal = sourceRootName
    ? signals.find((signal) => signal === `${sourceRootName}/${name}/`) || null
    : null;
  const commitSignals = signals.filter((signal) => signal.startsWith("commit-scope:"));

  const candidateGoal = readmeSummary
    ? `Draft (from README): ${readmeSummary} — refine via grill so the Goal names what the user observes when '${name}' works.`
    : `Draft: what the user observes when the '${name}' capability works. Fill in via grill.`;

  const candidateScope = directorySignal
    ? `Owns the ${directorySignal} surface. Out-of-scope deferred to grill.`
    : `Inferred from commit scope '${name}'. Confirm the owning source surface and out-of-scope boundary in grill.`;

  const objectiveHint = charterObjectives.length > 0
    ? ` Candidate charter objective served: ${charterObjectives[0].id} (${charterObjectives[0].predicate.slice(0, 80)}${charterObjectives[0].predicate.length > 80 ? "..." : ""}). Confirm in grill.`
    : "";

  return {
    name,
    signals,
    provenance: {
      directory: directorySignal,
      commit_scopes: commitSignals,
    },
    candidate_goal: candidateGoal + objectiveHint,
    candidate_scope: candidateScope,
  };
}

function mergeCandidates({ sourceRoot, dirNames, scopeCounts }) {
  const merged = new Map();

  for (const name of dirNames) {
    const signals = [`${sourceRoot.name}/${name}/`];
    const count = scopeCounts.get(name) ?? 0;
    if (count > 0) signals.push(`commit-scope:${name} (${count})`);
    merged.set(name, signals);
  }

  for (const [scope, count] of scopeCounts.entries()) {
    if (merged.has(scope)) continue;
    if (count < 2) continue;
    merged.set(scope, [`commit-scope:${scope} (${count})`]);
  }

  return [...merged.entries()]
    .sort(([a], [b]) => a.localeCompare(b));
}

function extractSignals({
  repoRoot = ".",
  commitLimit = DEFAULT_COMMIT_LIMIT,
  readFile = fs.readFileSync,
  fileExists = fs.existsSync,
  readdir = fs.readdirSync,
  statSync = fs.statSync,
  exec = execFileSync,
} = {}) {
  const deps = { readFile, fileExists, statSync, readdir, exec };

  const readme = readOptionalFile(path.join(repoRoot, "README.md"), deps);
  const charter = resolveCharterFile(repoRoot, deps);
  const claudeMd = readOptionalFile(path.join(repoRoot, "CLAUDE.md"), deps);
  const agentsMd = readOptionalFile(path.join(repoRoot, "AGENTS.md"), deps);
  const harnessFiles = [
    ["CLAUDE.md", claudeMd],
    ["AGENTS.md", agentsMd],
  ].filter(([, content]) => content !== null).map(([name]) => name);
  const sourceRoot = detectSourceRoot(repoRoot, deps);
  const dirNames = listCapabilityCandidates(sourceRoot, deps);
  const commitMessages = getRecentCommitMessages(repoRoot, commitLimit, deps);
  const scopeCounts = extractCommitScopes(commitMessages);
  const charterObjectives = readCharterObjectives(repoRoot, deps);
  const readmeSummary = summarizeReadme(readme);

  const inventory = {
    repoRoot: path.resolve(repoRoot),
    readmeFound: readme !== null,
    charterFound: charter.found,
    charterPath: charter.found ? charter.path : null,
    charterSource: charter.source,
    claudeMdFound: harnessFiles.length > 0,
    harnessFiles,
    sourceRoot: sourceRoot ? sourceRoot.name : null,
    sourceDirCount: dirNames.length,
    commitsScanned: commitMessages.length,
    commitScopeCount: scopeCounts.size,
    charterObjectiveCount: charterObjectives.length,
  };
  const signalAuthority = buildSignalAuthority({
    readmeFound: readme !== null,
    charterFound: charter.found,
    charterSource: charter.source,
    harnessFiles,
    sourceRoot,
    commitsScanned: commitMessages.length,
  });

  const candidates = sourceRoot ? mergeCandidates({ sourceRoot, dirNames, scopeCounts }) : [];

  const capabilities = candidates.map(([name, signals]) =>
    buildCapability({
      name,
      sourceRootName: sourceRoot ? sourceRoot.name : null,
      signals,
      readmeSummary,
      charterObjectives,
    }),
  );

  return { inventory, signal_authority: signalAuthority, capabilities };
}

function formatHumanReport(result) {
  const { inventory, capabilities } = result;
  const lines = [];
  lines.push(`Repo: ${inventory.repoRoot}`);
  lines.push("Signals:");
  lines.push(`  - README.md: ${inventory.readmeFound ? "found" : "missing"}`);
  lines.push(`  - spec/charter.md: ${inventory.charterFound ? `found (${inventory.charterSource})` : "missing"}; objectives: ${inventory.charterObjectiveCount}`);
  lines.push(`  - CLAUDE.md/AGENTS.md: ${inventory.claudeMdFound ? `found (${(inventory.harnessFiles || []).join(", ")})` : "missing"}; authority: development-harness`);
  lines.push(`  - source root: ${inventory.sourceRoot ?? "none detected"} (${inventory.sourceDirCount} dir(s))`);
  lines.push(`  - commits scanned: ${inventory.commitsScanned}; scopes seen: ${inventory.commitScopeCount}`);
  lines.push("");

  if (capabilities.length === 0) {
    lines.push("No raw capability signals detected.");
    lines.push("Grill mode will run in greenfield mode (interview from scratch).");
    return lines.join("\n");
  }

  lines.push(`Raw capability signals (${capabilities.length}, top ${Math.min(capabilities.length, SUMMARY_DIR_LIMIT)} shown):`);
  lines.push("  Note: these are interview seeds, not accepted capabilities. Grill mode admits, merges, splits, and names functional contracts.");
  for (const cap of capabilities.slice(0, SUMMARY_DIR_LIMIT)) {
    lines.push(`  - ${cap.name}`);
    lines.push(`      signals: ${cap.signals.join(", ")}`);
  }
  if (capabilities.length > SUMMARY_DIR_LIMIT) {
    lines.push(`  ... and ${capabilities.length - SUMMARY_DIR_LIMIT} more (use --json for full draft)`);
  }
  lines.push("");
  lines.push("Next: invoke `spec-grill` to admit raw signals and interview compact capabilities into spec/capabilities.md.");
  return lines.join("\n");
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) { console.error(parsed.error); process.exit(1); }
  if (parsed.help) { console.log(usage()); return; }

  const result = extractSignals(parsed);

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatHumanReport(result));
  if (parsed.dryRun) {
    console.log("");
    console.log("[dry-run] No files written. extract-signals never writes; the flag is a no-op for parity with sibling scripts.");
  }
}

if (require.main === module) main();

module.exports = {
  buildSignalAuthority,
  parseArgs,
  detectSourceRoot,
  listCapabilityCandidates,
  extractCommitScopes,
  getRecentCommitMessages,
  readOptionalFile,
  resolveCharterFile,
  CANONICAL_CHARTER_PATH,
  LEGACY_CHARTER_PATH,
  readCharterObjectives,
  summarizeReadme,
  buildCapability,
  mergeCandidates,
  extractSignals,
  formatHumanReport,
};
