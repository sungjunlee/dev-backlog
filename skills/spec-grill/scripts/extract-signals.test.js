const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseArgs,
  detectSourceRoot,
  listCapabilityCandidates,
  extractCommitScopes,
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
  readCharterObjectives,
  summarizeReadme,
  buildSignalAuthority,
  buildCapability,
  mergeCandidates,
  extractSignals,
  formatHumanReport,
} = require("./extract-signals.js");

function makeRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "extract-signals-"));
}

function write(repo, relPath, content) {
  const full = path.join(repo, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function mkdir(repo, relPath) {
  fs.mkdirSync(path.join(repo, relPath), { recursive: true });
}

describe("parseArgs", () => {
  it("uses defaults when no args", () => {
    const parsed = parseArgs([]);
    assert.equal(parsed.repoRoot, ".");
    assert.equal(parsed.commitLimit, 100);
    assert.equal(parsed.dryRun, false);
    assert.equal(parsed.json, false);
  });

  it("accepts --repo-root, --commit-limit, --dry-run, --json", () => {
    const parsed = parseArgs(["--repo-root", "/x", "--commit-limit", "25", "--dry-run", "--json"]);
    assert.equal(parsed.repoRoot, "/x");
    assert.equal(parsed.commitLimit, 25);
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.json, true);
  });

  it("accepts the = form", () => {
    const parsed = parseArgs(["--repo-root=/x", "--commit-limit=25"]);
    assert.equal(parsed.repoRoot, "/x");
    assert.equal(parsed.commitLimit, 25);
  });

  it("errors on unknown argument", () => {
    assert.match(parseArgs(["--bogus"]).error, /Unknown argument/);
  });

  it("errors on non-numeric --commit-limit", () => {
    assert.match(parseArgs(["--commit-limit", "abc"]).error, /positive integer/);
  });

  it("errors on missing --repo-root value", () => {
    assert.match(parseArgs(["--repo-root"]).error, /Missing value/);
  });
});

describe("detectSourceRoot", () => {
  let repo;
  beforeEach(() => { repo = makeRepo(); });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it("returns null when no source-root candidate exists", () => {
    assert.equal(detectSourceRoot(repo), null);
  });

  it("prefers src/ over the others (priority order)", () => {
    mkdir(repo, "src");
    mkdir(repo, "lib");
    assert.equal(detectSourceRoot(repo).name, "src");
  });

  it("falls back to skills/ when canonical roots are absent", () => {
    mkdir(repo, "skills");
    assert.equal(detectSourceRoot(repo).name, "skills");
  });
});

describe("listCapabilityCandidates", () => {
  let repo;
  beforeEach(() => { repo = makeRepo(); });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it("lists directory entries alphabetically and skips dotfiles", () => {
    mkdir(repo, "src/zeta");
    mkdir(repo, "src/alpha");
    mkdir(repo, "src/.hidden");
    write(repo, "src/index.js", "");
    const result = listCapabilityCandidates({ name: "src", path: path.join(repo, "src") });
    assert.deepEqual(result, ["alpha", "zeta"]);
  });

  it("returns empty when source root is null", () => {
    assert.deepEqual(listCapabilityCandidates(null), []);
  });
});

describe("extractCommitScopes", () => {
  it("aggregates conventional-commit scopes", () => {
    const messages = [
      "feat(auth): add login",
      "fix(auth): retry on token expiry",
      "docs(auth): clarify flow",
      "chore(api): bump deps",
      "feat: scopeless commit",
      "feat(api,auth): combined scope",
    ];
    const scopes = extractCommitScopes(messages);
    assert.equal(scopes.get("auth"), 4);
    assert.equal(scopes.get("api"), 2);
  });

  it("returns empty map for an empty input", () => {
    assert.equal(extractCommitScopes([]).size, 0);
  });

  it("ignores non-conventional commit messages", () => {
    const scopes = extractCommitScopes(["random merge commit", "WIP something"]);
    assert.equal(scopes.size, 0);
  });
});

describe("readOptionalFile", () => {
  let repo;
  beforeEach(() => { repo = makeRepo(); });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it("returns null when the file is missing", () => {
    assert.equal(readOptionalFile(path.join(repo, "no.md")), null);
  });

  it("returns content when the file exists", () => {
    write(repo, "README.md", "hello");
    assert.equal(readOptionalFile(path.join(repo, "README.md")), "hello");
  });
});

describe("readCharterObjectives", () => {
  let repo;
  beforeEach(() => { repo = makeRepo(); });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it("returns empty when spec/charter.md and legacy CHARTER.md are absent", () => {
    assert.deepEqual(readCharterObjectives(repo), []);
  });

  it("parses validated/active/deferred objectives from spec/charter.md", () => {
    const charter = `---
revision: 1
---

# Charter

## Objectives
- O1 [validated] outcome one · src: user
- O2 [active]    outcome two · src: user
- O3 [deferred]  outcome three deferred to follow-up
`;
    write(repo, "spec/charter.md", charter);
    const objectives = readCharterObjectives(repo);
    assert.equal(objectives.length, 3);
    assert.equal(objectives[0].id, "O1");
    assert.equal(objectives[0].status, "validated");
    assert.match(objectives[0].predicate, /outcome one/);
  });

  it("falls back to legacy root CHARTER.md", () => {
    write(repo, "CHARTER.md", "- O1 [active] legacy objective · src: user\n");
    const resolved = resolveCharterFile(repo);
    assert.equal(resolved.found, true);
    assert.equal(resolved.source, "legacy");
    const objectives = readCharterObjectives(repo);
    assert.equal(objectives.length, 1);
    assert.equal(objectives[0].id, "O1");
  });
});

describe("summarizeReadme", () => {
  it("returns the first non-heading prose line", () => {
    const readme = "# Project\n\n[![badge](url)](#)\n\nA tool that does X for Y.";
    assert.equal(summarizeReadme(readme), "A tool that does X for Y.");
  });

  it("truncates very long prose with an ellipsis", () => {
    const long = "x ".repeat(300);
    const out = summarizeReadme(`# T\n\n${long}`);
    assert.ok(out.length <= 240);
    assert.ok(out.endsWith("..."));
  });

  it("returns null when there is no prose", () => {
    assert.equal(summarizeReadme("# Only headings\n\n## Subhead\n"), null);
  });

  it("skips centered badge and navigation markup before prose", () => {
    const readme = `# 탐구노트

<div align="center">

**AI-Powered Educational Portfolio for Parents**

[![Flutter](https://img.shields.io/badge/Flutter-3.41.4-blue)](https://flutter.dev)

[Features](#features) • [Quick Start](#quick-start) • [Docs](#docs)

</div>

## What is this?

Tamgu Note helps parents discover children's hidden talents through AI-powered activity analysis.`;
    assert.equal(summarizeReadme(readme), "**AI-Powered Educational Portfolio for Parents**");
  });

  it("returns null for an empty readme", () => {
    assert.equal(summarizeReadme(null), null);
    assert.equal(summarizeReadme(""), null);
  });
});

describe("evidence collectors", () => {
  let repo;
  beforeEach(() => { repo = makeRepo(); });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it("slugifies candidate handles deterministically", () => {
    assert.equal(slugifyCandidate("Sync Pull!"), "sync-pull");
    assert.equal(slugifyCandidate("`backlog-sync`"), "backlog-sync");
  });

  it("parses system-map candidate boundaries", () => {
    const systemMap = `# Map

## Candidate Capability Boundaries

- \`backlog-sync\` - evidence: sync flow; owns task mirrors; uncertainty: triage boundary.
- \`triage-grooming\` - evidence: report flow; owns issue review; uncertainty: apply boundary.

## Where To Go Next
`;
    const candidates = collectSystemMapCandidates(systemMap);
    assert.deepEqual(candidates.map((c) => c.name), ["backlog-sync", "triage-grooming"]);
    assert.match(candidates[0].signal, /sync flow/);
  });

  it("collects README capability-like bullets only under relevant headings", () => {
    const readme = `# Project

## Features
- \`backlog-sync\` - mirror issues locally
- Triage grooming: classify issues

## License
- MIT
`;
    const candidates = collectReadmeCandidates(readme);
    assert.deepEqual(candidates.map((c) => c.name), ["backlog-sync", "triage-grooming"]);
  });

  it("collects skill, script, docs, and paired test evidence", () => {
    write(repo, "skills/spec-grill/SKILL.md", `---
name: spec-grill
description: Create capability contracts.
---
`);
    write(repo, "skills/spec-grill/scripts/extract-signals.js", "");
    write(repo, "skills/spec-grill/scripts/extract-signals.test.js", "");
    write(repo, "skills/spec-grill/references/capabilities.md", "# Capability reference\n");
    write(repo, "docs/spec-system-design.md", "# Spec design\n");

    assert.deepEqual(collectSkillCandidates(repo).map((c) => c.name), ["spec-grill"]);
    assert.ok(collectScriptCandidates(repo).some((c) => c.name === "extract-signals"));
    assert.ok(collectTestCandidates(repo).some((c) => c.name === "extract-signals"));
    assert.deepEqual(collectDocCandidates(repo), []);
    assert.ok(collectDocCandidates(repo, {}, ["spec-system"]).some((c) => c.signal.includes("docs/spec-system-design.md")));
  });

  it("collects source commands, source surfaces, and source tests", () => {
    write(repo, "src/kwi/cli/commands/github-pr-export.ts", "");
    write(repo, "src/kwi/cli/commands/github-pr-export.test.ts", "");
    write(repo, "src/kwi/sources/confluence.ts", "");
    write(repo, "src/kwi/sources/jira/index.ts", "");
    write(repo, "tests/unit/sources/confluence.test.ts", "");

    assert.deepEqual(collectCliCommandCandidates(repo).map((c) => c.name), ["github-pr-export"]);
    assert.deepEqual(collectSourceSurfaceCandidates(repo).map((c) => c.name), ["confluence", "jira"]);
    assert.deepEqual(collectSourceTestCandidates(repo).map((c) => c.name), ["confluence"]);
  });
});

describe("buildSignalAuthority", () => {
  it("labels CLAUDE.md/AGENTS.md as development-harness authority", () => {
    const authority = buildSignalAuthority({
      readmeFound: true,
      charterFound: true,
      harnessFiles: ["CLAUDE.md", "AGENTS.md"],
      sourceRoot: { name: "src", path: "/repo/src" },
      commitsScanned: 4,
    });

    const harness = authority.find((entry) => entry.signal === "CLAUDE.md/AGENTS.md");
    assert.equal(harness.authority, "development-harness");
    assert.equal(harness.found, true);
    assert.match(harness.note, /does not create product capability boundaries/);
  });

  it("labels an objective-empty spec/charter.md as found product authority", () => {
    const authority = buildSignalAuthority({
      readmeFound: false,
      charterFound: true,
      charterSource: "canonical",
      harnessFiles: [],
      sourceRoot: null,
      commitsScanned: 0,
    });

    const charter = authority.find((entry) => entry.signal === "spec/charter.md");
    assert.equal(charter.authority, "product");
    assert.equal(charter.found, true);
  });
});

describe("buildCapability", () => {
  it("includes a charter objective hint when objectives are present", () => {
    const cap = buildCapability({
      name: "auth",
      sourceRootName: "src",
      signals: ["src/auth/", "commit-scope:auth (4)"],
      readmeSummary: "Auth thing",
      charterObjectives: [{ id: "O1", predicate: "users can log in" }],
    });
    assert.match(cap.candidate_goal, /O1/);
    assert.match(cap.candidate_scope, /src\/auth\//);
    assert.equal(cap.provenance.directory, "src/auth/");
    assert.deepEqual(cap.provenance.commit_scopes, ["commit-scope:auth (4)"]);
  });

  it("falls back to placeholder goal when no readme summary", () => {
    const cap = buildCapability({
      name: "auth",
      sourceRootName: "src",
      signals: ["src/auth/"],
      readmeSummary: null,
      charterObjectives: [],
    });
    assert.match(cap.candidate_goal, /Fill in via grill/);
  });

  it("does not invent a path for commit-scope-only candidates", () => {
    const cap = buildCapability({
      name: "progress-sync",
      sourceRootName: "skills",
      signals: ["commit-scope:progress-sync (3)"],
      readmeSummary: null,
      charterObjectives: [],
    });
    assert.equal(cap.provenance.directory, null);
    assert.deepEqual(cap.provenance.commit_scopes, ["commit-scope:progress-sync (3)"]);
    assert.doesNotMatch(cap.candidate_scope, /skills\/progress-sync/);
    assert.match(cap.candidate_scope, /Inferred from commit scope/);
  });
});

describe("mergeCandidates", () => {
  it("merges dir candidates with commit-scope counts", () => {
    const sourceRoot = { name: "src", path: "/repo/src" };
    const scopeCounts = new Map([["auth", 4], ["api", 3], ["billing", 5]]);
    const merged = mergeCandidates({
      sourceRoot,
      dirNames: ["auth", "api"],
      scopeCounts,
    });
    const names = merged.map(([n]) => n);
    assert.deepEqual(names, ["api", "auth", "billing"]);
    const auth = merged.find(([n]) => n === "auth")[1];
    assert.ok(auth.includes("src/auth/"));
    assert.ok(auth.some((s) => s.includes("commit-scope:auth")));
  });

  it("requires >=2 commits to surface a scope without a dir", () => {
    const sourceRoot = { name: "src", path: "/repo/src" };
    const merged = mergeCandidates({
      sourceRoot,
      dirNames: ["existing"],
      scopeCounts: new Map([["existing", 5], ["onehit", 1]]),
    });
    assert.equal(merged.length, 1);
    assert.equal(merged[0][0], "existing");
  });
});

describe("extractSignals — integration fixtures", () => {
  let repo;
  beforeEach(() => { repo = makeRepo(); });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it("greenfield: no README, no source root, no commits → empty capabilities + degraded inventory", () => {
    const result = extractSignals({ repoRoot: repo, exec: () => { throw new Error("no git"); } });
    assert.equal(result.inventory.readmeFound, false);
    assert.equal(result.inventory.claudeMdFound, false);
    assert.equal(result.inventory.sourceRoot, null);
    assert.equal(result.inventory.sourceDirCount, 0);
    assert.equal(result.inventory.commitsScanned, 0);
    assert.equal(result.capabilities.length, 0);
  });

  it("brownfield-full: README + CLAUDE.md + src/ + commits + spec charter", () => {
    write(repo, "README.md", "# Project\n\nA logging pipeline.\n");
    write(repo, "CLAUDE.md", "# Conventions\n\nUse pino.\n");
    mkdir(repo, "src/ingest");
    mkdir(repo, "src/storage");
    write(repo, "spec/charter.md", `---
revision: 1
---
## Objectives
- O1 [active] users see fresh logs · src: user
`);

    const commitMessages = [
      "feat(ingest): add backpressure",
      "fix(ingest): handle null events",
      "feat(storage): add disk tier",
      "chore: bump deps",
      "feat(api): unrelated scope",
    ];

    const result = extractSignals({
      repoRoot: repo,
      exec: () => commitMessages.join("\n"),
    });

    assert.equal(result.inventory.readmeFound, true);
    assert.equal(result.inventory.charterFound, true);
    assert.equal(result.inventory.charterSource, "canonical");
    assert.equal(result.inventory.systemMapFound, false);
    assert.equal(result.inventory.claudeMdFound, true);
    assert.deepEqual(result.inventory.harnessFiles, ["CLAUDE.md"]);
    assert.equal(result.inventory.sourceRoot, "src");
    assert.equal(result.inventory.sourceDirCount, 2);
    assert.equal(result.inventory.commitsScanned, 5);
    assert.equal(result.inventory.charterObjectiveCount, 1);

    const names = result.capabilities.map((c) => c.name);
    assert.ok(names.includes("ingest"));
    assert.ok(names.includes("storage"));

    const ingest = result.capabilities.find((c) => c.name === "ingest");
    assert.ok(ingest.signals.some((s) => s.includes("src/ingest/")));
    assert.ok(ingest.signals.some((s) => s.includes("commit-scope:ingest")));
    assert.equal(ingest.provenance.directory, "src/ingest/");
    assert.ok(ingest.evidence.source_dirs.includes("src/ingest/"));
    assert.ok(ingest.evidence.commits.some((s) => s.includes("commit-scope:ingest")));
    assert.deepEqual(ingest.missing_evidence, ["spec/system-map.md"]);
    assert.match(ingest.candidate_goal, /logging pipeline/);
    assert.match(ingest.candidate_goal, /O1/);

    const harness = result.signal_authority.find((entry) => entry.signal === "CLAUDE.md/AGENTS.md");
    assert.equal(harness.authority, "development-harness");
    assert.equal(harness.found, true);
  });

  it("reports spec/charter.md as found even when it has no Objectives", () => {
    write(repo, "spec/charter.md", "# Charter\n\n## Decisions\n");

    const result = extractSignals({
      repoRoot: repo,
      exec: () => "",
    });

    assert.equal(result.inventory.charterFound, true);
    assert.equal(result.inventory.charterObjectiveCount, 0);
    assert.equal(
      result.signal_authority.find((entry) => entry.signal === "spec/charter.md").found,
      true,
    );
  });

  it("development harness files do not create capability candidates by themselves", () => {
    write(repo, "CLAUDE.md", "# Development\n\nUse pnpm. Keep PRs small.\n");

    const result = extractSignals({
      repoRoot: repo,
      exec: () => "",
    });

    assert.equal(result.inventory.claudeMdFound, true);
    assert.deepEqual(result.inventory.harnessFiles, ["CLAUDE.md"]);
    assert.deepEqual(result.capabilities, []);
    assert.equal(
      result.signal_authority.find((entry) => entry.signal === "CLAUDE.md/AGENTS.md").authority,
      "development-harness",
    );
  });

  it("AGENTS.md-only is treated as development-harness without creating capabilities", () => {
    write(repo, "AGENTS.md", "# Agent Rules\n\nUse npm run lint.\n");

    const result = extractSignals({
      repoRoot: repo,
      exec: () => "",
    });

    assert.equal(result.inventory.claudeMdFound, true);
    assert.deepEqual(result.inventory.harnessFiles, ["AGENTS.md"]);
    assert.deepEqual(result.capabilities, []);
    const harness = result.signal_authority.find((entry) => entry.signal === "CLAUDE.md/AGENTS.md");
    assert.equal(harness.authority, "development-harness");
    assert.equal(harness.found, true);
  });

  it("brownfield commit-scope-only: keeps provenance explicit without fake ownership", () => {
    mkdir(repo, "src/worker");
    const commits = ["feat(progress-sync): one", "fix(progress-sync): two"];
    const result = extractSignals({
      repoRoot: repo,
      exec: () => commits.join("\n"),
    });

    const progressSync = result.capabilities.find((c) => c.name === "progress-sync");
    assert.ok(progressSync);
    assert.equal(progressSync.provenance.directory, null);
    assert.ok(progressSync.evidence.commits.some((s) => s.includes("commit-scope:progress-sync")));
    assert.match(progressSync.candidate_scope, /Confirm the owning source surface/);
    assert.doesNotMatch(progressSync.candidate_scope, /src\/progress-sync/);
  });

  it("groups system-map, skill, script, docs, tests, and commits under candidates", () => {
    write(repo, "README.md", `# Project

## Features
- \`backlog-sync\` - mirror issues locally
`);
    write(repo, "spec/system-map.md", `# Map

## Candidate Capability Boundaries

- \`backlog-sync\` - evidence: sync flow; owns task mirrors; uncertainty: triage boundary.
`);
    write(repo, "skills/backlog-sync/SKILL.md", `---
name: backlog-sync
description: Mirror issues.
---
`);
    write(repo, "skills/backlog-sync/scripts/sync-pull.js", "");
    write(repo, "skills/backlog-sync/scripts/sync-pull.test.js", "");
    write(repo, "docs/backlog-sync-guide.md", "# Backlog sync guide\n");
    write(repo, "src/kwi/cli/commands/github-pr-export.ts", "");
    write(repo, "src/kwi/sources/confluence.ts", "");
    write(repo, "tests/unit/sources/confluence.test.ts", "");

    const result = extractSignals({
      repoRoot: repo,
      exec: () => "feat(backlog-sync): add mirror\nfix(backlog-sync): preserve AC",
    });

    const candidate = result.capabilities.find((c) => c.name === "backlog-sync");
    assert.ok(candidate);
    assert.ok(candidate.evidence.system_map.length > 0);
    assert.ok(candidate.evidence.readme.length > 0);
    assert.ok(candidate.evidence.skill.length > 0);
    assert.ok(candidate.evidence.commits.length > 0);
    assert.equal(candidate.missing_evidence.length, 0);

    const syncPull = result.capabilities.find((c) => c.name === "sync-pull");
    assert.ok(syncPull);
    assert.ok(syncPull.evidence.scripts.length > 0);
    assert.ok(syncPull.evidence.tests.length > 0);

    const githubPrExport = result.capabilities.find((c) => c.name === "github-pr-export");
    assert.ok(githubPrExport);
    assert.ok(githubPrExport.evidence.scripts.length > 0);

    const confluence = result.capabilities.find((c) => c.name === "confluence");
    assert.ok(confluence);
    assert.ok(confluence.evidence.source_dirs.length > 0);
    assert.ok(confluence.evidence.tests.length > 0);
  });

  it("brownfield-thin: only src/ + commits, no README/CLAUDE", () => {
    mkdir(repo, "src/worker");
    const commits = ["feat(worker): initial scaffold", "fix(worker): race"];
    const result = extractSignals({
      repoRoot: repo,
      exec: () => commits.join("\n"),
    });

    assert.equal(result.inventory.readmeFound, false);
    assert.equal(result.inventory.claudeMdFound, false);
    assert.equal(result.inventory.sourceRoot, "src");
    assert.equal(result.capabilities.length, 1);
    assert.equal(result.capabilities[0].name, "worker");
    assert.match(result.capabilities[0].candidate_goal, /Fill in via grill/);
  });

  it("large feature-first repo: reports raw signals without treating feature count as final spec", () => {
    write(repo, "README.md", `# Tamgu Note

<div align="center">

[![Flutter](badge)](url)

[Features](#features) • [Quick Start](#quick-start)

</div>

Tamgu Note helps parents discover children's hidden talents through AI-powered activity analysis.
`);
    for (const feature of [
      "activity", "ai", "insight", "child", "family", "auth", "onboarding", "search",
      "settings", "sync", "storage",
    ]) {
      mkdir(repo, `lib/features/${feature}`);
    }
    const commits = [
      "feat(e2e): add patrol lane",
      "fix(e2e): stabilize image upload",
      "chore(sprint): close batch",
      "chore(sprint): dispatch next leaf",
      "test(activity): cover image-first cards",
      "fix(activity): edge cases",
      "chore(backlog): update sprint",
      "chore(backlog): mark issue done",
    ];

    const result = extractSignals({
      repoRoot: repo,
      exec: () => commits.join("\n"),
    });

    assert.equal(result.inventory.sourceRoot, "lib");
    assert.ok(result.capabilities.find((c) => c.name === "features"));
    assert.ok(result.capabilities.find((c) => c.name === "activity"));
    assert.ok(result.capabilities.find((c) => c.name === "e2e"));
    assert.match(result.capabilities[0].candidate_goal, /Tamgu Note helps parents/);
  });

  it("is deterministic: same inputs → same output", () => {
    write(repo, "README.md", "# Project\n\nLine.\n");
    mkdir(repo, "src/a");
    mkdir(repo, "src/b");
    const commits = ["feat(a): one", "feat(b): two", "feat(a): three"];
    const stub = { exec: () => commits.join("\n") };

    const r1 = extractSignals({ repoRoot: repo, ...stub });
    const r2 = extractSignals({ repoRoot: repo, ...stub });
    assert.deepEqual(r1, r2);
  });
});

describe("formatHumanReport", () => {
  it("renders the greenfield path", () => {
    const result = {
      inventory: {
        repoRoot: "/x", readmeFound: false, charterFound: false, claudeMdFound: false,
        sourceRoot: null, sourceDirCount: 0,
        commitsScanned: 0, commitScopeCount: 0, charterObjectiveCount: 0,
      },
      capabilities: [],
    };
    assert.match(formatHumanReport(result), /greenfield/);
  });

  it("renders raw capability signals under the summary limit", () => {
    const result = {
      inventory: {
        repoRoot: "/x", readmeFound: true, charterFound: false, claudeMdFound: false,
        sourceRoot: "src", sourceDirCount: 2,
        commitsScanned: 10, commitScopeCount: 2, charterObjectiveCount: 0,
      },
      capabilities: [
        { name: "auth",     signals: ["src/auth/", "commit-scope:auth (4)"],     candidate_goal: "", candidate_scope: "" },
        { name: "billing",  signals: ["src/billing/", "commit-scope:billing (2)"], candidate_goal: "", candidate_scope: "" },
      ],
    };
    const report = formatHumanReport(result);
    assert.match(report, /Raw capability signals \(2/);
    assert.match(report, /interview seeds/);
    assert.match(report, /auth/);
    assert.match(report, /billing/);
  });
});
