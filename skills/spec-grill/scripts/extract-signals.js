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
 *     capabilities: [{ name, signals, evidence, missing_evidence, candidate_goal, candidate_scope }]
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
const EVIDENCE_KINDS = ["system_map", "readme", "skill", "scripts", "docs", "tests", "source_dirs", "commits"];
const SUMMARY_DIR_LIMIT = 5;
const DEFAULT_COMMIT_LIMIT = 100;

function buildSignalAuthority({ readmeFound, charterFound, charterSource, systemMapFound, harnessFiles, sourceRoot, commitsScanned }) {
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
      signal: "spec/system-map.md",
      authority: "system-shape",
      found: systemMapFound,
      note: "High-level boundaries, flows, invariants, and candidate capability handoff evidence.",
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
      signal: "skill/script/doc/test surfaces",
      authority: "repo-surface",
      found: sourceRoot !== null,
      note: "Command and documentation surfaces can support candidates, but do not admit capabilities by themselves.",
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

function slugifyCandidate(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeEmptyEvidence() {
  return Object.fromEntries(EVIDENCE_KINDS.map((kind) => [kind, []]));
}

function addEvidence(candidates, name, kind, value) {
  const slug = slugifyCandidate(name);
  if (!slug || !EVIDENCE_KINDS.includes(kind) || !value) return;
  if (!candidates.has(slug)) {
    candidates.set(slug, {
      name: slug,
      signals: new Set(),
      evidence: makeEmptyEvidence(),
      missing_evidence: new Set(),
    });
  }
  const candidate = candidates.get(slug);
  if (!candidate.evidence[kind].includes(value)) {
    candidate.evidence[kind].push(value);
  }
  candidate.signals.add(value);
}

function addMissingEvidence(candidates, name, value) {
  const slug = slugifyCandidate(name);
  if (!slug) return;
  if (!candidates.has(slug)) {
    candidates.set(slug, {
      name: slug,
      signals: new Set(),
      evidence: makeEmptyEvidence(),
      missing_evidence: new Set(),
    });
  }
  candidates.get(slug).missing_evidence.add(value);
}

function getMarkdownSection(content, heading) {
  if (!content) return null;
  const lines = content.split("\n");
  const startPattern = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const start = lines.findIndex((line) => startPattern.test(line.trim()));
  if (start === -1) return null;
  const section = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    section.push(lines[i]);
  }
  return section.join("\n").trim();
}

function collectSystemMapCandidates(systemMap) {
  const section = getMarkdownSection(systemMap, "Candidate Capability Boundaries");
  if (!section) return [];
  const candidates = [];
  for (const line of section.split("\n")) {
    const match = line.match(/^-\s+`?([a-z][a-z0-9-]*)`?\s+-\s+(.+)$/);
    if (!match) continue;
    candidates.push({
      name: match[1],
      signal: `system-map:${match[1]} (${match[2].trim()})`,
    });
  }
  return candidates;
}

function collectReadmeCandidates(readme) {
  if (!readme) return [];
  const candidates = [];
  let activeHeading = null;
  for (const line of readme.split("\n")) {
    const heading = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (heading) {
      activeHeading = /capabilit|feature|support|command|skill/i.test(heading[1])
        ? heading[1].trim()
        : null;
      continue;
    }
    if (!activeHeading) continue;
    const bullet = line.match(/^-\s+(?:`([^`]+)`|([A-Za-z][A-Za-z0-9 -]{2,60}))(?:\s+[-:\u2013\u2014]\s+(.+))?/);
    if (!bullet) continue;
    const rawName = bullet[1] || bullet[2];
    const name = slugifyCandidate(rawName.split(/\s+/).slice(0, 4).join("-"));
    if (!name) continue;
    candidates.push({
      name,
      signal: `README:${activeHeading}: ${line.trim()}`,
    });
  }
  return candidates;
}

function listDirs(root, { readdir = fs.readdirSync, statSync = fs.statSync, fileExists = fs.existsSync } = {}) {
  if (!fileExists(root)) return [];
  return readdir(root)
    .filter((entry) => {
      if (entry.startsWith(".") || entry.startsWith("_")) return false;
      try {
        return statSync(path.join(root, entry)).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

function collectSkillCandidates(repoRoot, deps = {}) {
  const skillsRoot = path.join(repoRoot, "skills");
  return listDirs(skillsRoot, deps).flatMap((entry) => {
    const skillPath = path.join(skillsRoot, entry, "SKILL.md");
    const content = readOptionalFile(skillPath, deps);
    if (!content) return [];
    const name = content.match(/^name:\s*"?([^"\n]+)"?/m)?.[1]?.trim() || entry;
    const description = content.match(/^description:\s*"?([^"\n]+)"?/m)?.[1]?.trim() || "skill surface";
    return [{ name, signal: `skill:${entry} (${description.slice(0, 120)})` }];
  });
}

function collectScriptCandidates(repoRoot, deps = {}) {
  const skillsRoot = path.join(repoRoot, "skills");
  const candidates = [];
  for (const skill of listDirs(skillsRoot, deps)) {
    const scriptsRoot = path.join(skillsRoot, skill, "scripts");
    for (const entry of listScriptFiles(scriptsRoot, deps)) {
      if (/\.test\.js$|\.integration\.test\.js$|\.cli\.test\.js$/.test(entry)) continue;
      const base = entry.replace(/\.(test|cli|integration)\.js$/, "").replace(/\.(js|sh)$/, "");
      candidates.push({
        name: base,
        signal: `script:skills/${skill}/scripts/${entry}`,
      });
    }
  }
  candidates.push(...collectCliCommandCandidates(repoRoot, deps));
  return candidates;
}

function listScriptFiles(root, { readdir = fs.readdirSync, statSync = fs.statSync, fileExists = fs.existsSync } = {}) {
  if (!fileExists(root)) return [];
  return readdir(root)
    .filter((entry) => {
      try {
        return statSync(path.join(root, entry)).isFile() && /\.(?:[cm]?[jt]s|sh)$/.test(entry);
      } catch {
        return false;
      }
    })
    .sort();
}

function collectCliCommandCandidates(repoRoot, deps = {}) {
  const srcRoot = path.join(repoRoot, "src");
  const candidates = [];
  for (const packageName of listDirs(srcRoot, deps)) {
    const commandsRoot = path.join(srcRoot, packageName, "cli", "commands");
    for (const entry of listScriptFiles(commandsRoot, deps)) {
      if (/\.test\.[cm]?[jt]s$/.test(entry)) continue;
      const base = entry.replace(/\.[cm]?[jt]s$/, "");
      candidates.push({
        name: base,
        signal: `script:src/${packageName}/cli/commands/${entry}`,
      });
    }
  }
  return candidates;
}

function collectSourceSurfaceCandidates(repoRoot, deps = {}) {
  const srcRoot = path.join(repoRoot, "src");
  const candidates = [];
  for (const packageName of listDirs(srcRoot, deps)) {
    const sourcesRoot = path.join(srcRoot, packageName, "sources");
    for (const entry of listSourceSurfaceEntries(sourcesRoot, deps)) {
      const base = entry.replace(/\.[cm]?[jt]s$/, "");
      candidates.push({
        name: base,
        signal: `source:src/${packageName}/sources/${entry}`,
      });
    }
  }
  return candidates;
}

function listSourceSurfaceEntries(root, { readdir = fs.readdirSync, statSync = fs.statSync, fileExists = fs.existsSync } = {}) {
  if (!fileExists(root)) return [];
  return readdir(root)
    .filter((entry) => {
      if (entry.startsWith(".") || entry.startsWith("_")) return false;
      try {
        const stat = statSync(path.join(root, entry));
        return stat.isDirectory() || (stat.isFile() && /\.[cm]?[jt]s$/.test(entry) && !/\.test\.[cm]?[jt]s$/.test(entry));
      } catch {
        return false;
      }
    })
    .sort();
}

function collectDocCandidates(repoRoot, deps = {}, knownNames = []) {
  const roots = ["docs", "skills"];
  const candidates = [];
  const known = knownNames.map((name) => slugifyCandidate(name)).filter(Boolean).sort((a, b) => b.length - a.length);
  for (const rootName of roots) {
    const root = path.join(repoRoot, rootName);
    for (const relPath of listMarkdownFiles(root, deps).slice(0, 100)) {
      const normalized = relPath.replace(/\\/g, "/");
      const normalizedSlug = slugifyCandidate(normalized);
      const matched = known.find((name) => normalizedSlug.includes(name));
      if (!matched) continue;
      candidates.push({
        name: matched,
        signal: `doc:${rootName}/${normalized}`,
      });
    }
  }
  return candidates;
}

function listMarkdownFiles(root, deps = {}, prefix = "") {
  const { readdir = fs.readdirSync, statSync = fs.statSync, fileExists = fs.existsSync } = deps;
  if (!fileExists(root)) return [];
  const files = [];
  for (const entry of readdir(root).sort()) {
    if (entry.startsWith(".")) continue;
    const full = path.join(root, entry);
    const rel = path.join(prefix, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      files.push(...listMarkdownFiles(full, deps, rel));
    } else if (stat.isFile() && entry.endsWith(".md")) {
      files.push(rel);
    }
  }
  return files;
}

function collectTestCandidates(repoRoot, deps = {}) {
  const skillsRoot = path.join(repoRoot, "skills");
  const candidates = [];
  for (const skill of listDirs(skillsRoot, deps)) {
    const scriptsRoot = path.join(skillsRoot, skill, "scripts");
    for (const entry of listScriptFiles(scriptsRoot, deps)) {
      if (!/\.test\.js$|\.integration\.test\.js$|\.cli\.test\.js$/.test(entry)) continue;
      const base = entry.replace(/\.(integration|cli)\.test\.js$/, "").replace(/\.test\.js$/, "");
      candidates.push({
        name: base,
        signal: `test:skills/${skill}/scripts/${entry}`,
      });
    }
  }
  candidates.push(...collectSourceTestCandidates(repoRoot, deps));
  return candidates;
}

function collectSourceTestCandidates(repoRoot, deps = {}) {
  const testsRoot = path.join(repoRoot, "tests", "unit", "sources");
  return listScriptFiles(testsRoot, deps)
    .filter((entry) => /\.(test|spec)\.[cm]?[jt]s$|^[^.]+\.[cm]?[jt]s$/.test(entry))
    .map((entry) => ({
      name: entry.replace(/\.(test|spec)\.[cm]?[jt]s$/, "").replace(/\.[cm]?[jt]s$/, ""),
      signal: `test:tests/unit/sources/${entry}`,
    }));
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

function buildCapability({ name, sourceRootName, signals, evidence, missingEvidence, readmeSummary, charterObjectives }) {
  const directorySignal = sourceRootName
    ? signals.find((signal) => signal === `${sourceRootName}/${name}/`) || null
    : null;
  const commitSignals = signals.filter((signal) => signal.startsWith("commit-scope:"));
  const systemMapSignals = evidence?.system_map || [];
  const scriptSignals = evidence?.scripts || [];
  const evidenceHint = systemMapSignals[0] || scriptSignals[0] || null;
  let candidateGoal = `Draft: what the user observes when the '${name}' capability works. Fill in via grill.`;
  if (evidenceHint) {
    candidateGoal = `Draft (from evidence): ${evidenceHint} - refine via grill so the Goal names what the user observes when '${name}' works.`;
  } else if (readmeSummary) {
    candidateGoal = `Draft (from README): ${readmeSummary} - refine via grill so the Goal names what the user observes when '${name}' works.`;
  }

  let candidateScope = `Inferred from raw evidence for '${name}'. Confirm the owning surface and out-of-scope boundary in grill.`;
  if (systemMapSignals[0]) {
    candidateScope = `Inferred from ${systemMapSignals[0]}. Confirm ownership, neighboring candidates, and out-of-scope boundary in grill.`;
  } else if (directorySignal) {
    candidateScope = `Owns the ${directorySignal} surface. Out-of-scope deferred to grill.`;
  } else if (commitSignals.length > 0) {
    candidateScope = `Inferred from commit scope '${name}'. Confirm the owning source surface and out-of-scope boundary in grill.`;
  }

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
    evidence: evidence || makeEmptyEvidence(),
    missing_evidence: missingEvidence || [],
    confidence: "candidate-only",
    candidate_goal: candidateGoal + objectiveHint,
    candidate_scope: candidateScope,
  };
}

function mergeCandidates({ sourceRoot, dirNames, scopeCounts, evidenceCandidates = [] }) {
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

  for (const { name, signal } of evidenceCandidates) {
    const slug = slugifyCandidate(name);
    if (!slug || !signal) continue;
    const signals = merged.get(slug) || [];
    if (!signals.includes(signal)) signals.push(signal);
    merged.set(slug, signals);
  }

  return [...merged.entries()].sort(([a, aSignals], [b, bSignals]) => {
    const scoreDiff = candidateSignalScore(aSignals) - candidateSignalScore(bSignals);
    return scoreDiff || a.localeCompare(b);
  });
}

function candidateSignalScore(signals) {
  if (signals.some((signal) => signal.startsWith("system-map:"))) return 0;
  if (signals.some((signal) => signal.startsWith("skill:") || /^[a-z]+\/.+\/$/.test(signal))) return 1;
  if (signals.some((signal) => signal.startsWith("script:") || signal.startsWith("test:"))) return 2;
  if (signals.some((signal) => signal.startsWith("commit-scope:"))) return 3;
  if (signals.some((signal) => signal.startsWith("doc:"))) return 4;
  return 5;
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
  const systemMap = readOptionalFile(path.join(repoRoot, "spec", "system-map.md"), deps);
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
  const groupedEvidence = new Map();

  const inventory = {
    repoRoot: path.resolve(repoRoot),
    readmeFound: readme !== null,
    charterFound: charter.found,
    charterPath: charter.found ? charter.path : null,
    charterSource: charter.source,
    systemMapFound: systemMap !== null,
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
    systemMapFound: systemMap !== null,
    harnessFiles,
    sourceRoot,
    commitsScanned: commitMessages.length,
  });

  for (const name of dirNames) {
    if (sourceRoot) addEvidence(groupedEvidence, name, "source_dirs", `${sourceRoot.name}/${name}/`);
  }
  for (const [scope, count] of scopeCounts.entries()) {
    if (count >= 2 || dirNames.includes(scope)) {
      addEvidence(groupedEvidence, scope, "commits", `commit-scope:${scope} (${count})`);
    }
  }
  for (const candidate of collectSystemMapCandidates(systemMap)) {
    addEvidence(groupedEvidence, candidate.name, "system_map", candidate.signal);
  }
  for (const candidate of collectReadmeCandidates(readme)) {
    addEvidence(groupedEvidence, candidate.name, "readme", candidate.signal);
  }
  for (const candidate of collectSkillCandidates(repoRoot, deps)) {
    addEvidence(groupedEvidence, candidate.name, "skill", candidate.signal);
  }
  for (const candidate of collectSourceSurfaceCandidates(repoRoot, deps)) {
    addEvidence(groupedEvidence, candidate.name, "source_dirs", candidate.signal);
  }
  for (const candidate of collectScriptCandidates(repoRoot, deps)) {
    addEvidence(groupedEvidence, candidate.name, "scripts", candidate.signal);
  }
  for (const candidate of collectTestCandidates(repoRoot, deps)) {
    addEvidence(groupedEvidence, candidate.name, "tests", candidate.signal);
  }
  for (const candidate of collectDocCandidates(repoRoot, deps, [...groupedEvidence.keys()])) {
    addEvidence(groupedEvidence, candidate.name, "docs", candidate.signal);
  }

  if (!systemMap) {
    for (const name of dirNames) addMissingEvidence(groupedEvidence, name, "spec/system-map.md");
  }

  const evidenceCandidates = [...groupedEvidence.values()].flatMap((candidate) =>
    EVIDENCE_KINDS.flatMap((kind) =>
      candidate.evidence[kind].map((signal) => ({ name: candidate.name, signal })),
    ),
  );

  const candidates = sourceRoot
    ? mergeCandidates({ sourceRoot, dirNames, scopeCounts, evidenceCandidates })
    : mergeCandidates({ sourceRoot: { name: "", path: "" }, dirNames: [], scopeCounts, evidenceCandidates });

  const capabilities = candidates.map(([name, signals]) =>
    buildCapability({
      name,
      sourceRootName: sourceRoot ? sourceRoot.name : null,
      signals,
      evidence: groupedEvidence.get(name)?.evidence,
      missingEvidence: [...(groupedEvidence.get(name)?.missing_evidence || [])].sort(),
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
  lines.push(`  - spec/system-map.md: ${inventory.systemMapFound ? "found" : "missing"}`);
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
    const evidenceKinds = EVIDENCE_KINDS.filter((kind) => (cap.evidence?.[kind] || []).length > 0);
    if (evidenceKinds.length > 0) {
      lines.push(`      evidence: ${evidenceKinds.join(", ")}`);
    }
    if ((cap.missing_evidence || []).length > 0) {
      lines.push(`      missing: ${cap.missing_evidence.join(", ")}`);
    }
  }
  if (capabilities.length > SUMMARY_DIR_LIMIT) {
    lines.push(`  ... and ${capabilities.length - SUMMARY_DIR_LIMIT} more (use --json for full draft)`);
  }
  lines.push("");
  lines.push("Next: ask `spec-grill` to review these candidate capability boundaries before editing spec/capabilities.md.");
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
  slugifyCandidate,
  collectSystemMapCandidates,
  collectReadmeCandidates,
  collectSkillCandidates,
  collectScriptCandidates,
  collectCliCommandCandidates,
  collectSourceSurfaceCandidates,
  collectDocCandidates,
  collectTestCandidates,
  collectSourceTestCandidates,
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
