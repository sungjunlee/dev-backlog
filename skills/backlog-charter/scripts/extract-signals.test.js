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
  readCharterObjectives,
  summarizeReadme,
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

  it("returns empty when CHARTER.md is absent", () => {
    assert.deepEqual(readCharterObjectives(repo), []);
  });

  it("parses validated/active/deferred objectives", () => {
    const charter = `---
revision: 1
---

# Charter

## Objectives
- O1 [validated] outcome one · src: user
- O2 [active]    outcome two · src: user
- O3 [deferred]  outcome three deferred to follow-up
`;
    write(repo, "CHARTER.md", charter);
    const objectives = readCharterObjectives(repo);
    assert.equal(objectives.length, 3);
    assert.equal(objectives[0].id, "O1");
    assert.equal(objectives[0].status, "validated");
    assert.match(objectives[0].predicate, /outcome one/);
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

  it("returns null for an empty readme", () => {
    assert.equal(summarizeReadme(null), null);
    assert.equal(summarizeReadme(""), null);
  });
});

describe("buildCapability", () => {
  it("includes a CHARTER objective hint when objectives are present", () => {
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

  it("brownfield-full: README + CLAUDE.md + src/ + commits + CHARTER", () => {
    write(repo, "README.md", "# Project\n\nA logging pipeline.\n");
    write(repo, "CLAUDE.md", "# Conventions\n\nUse pino.\n");
    mkdir(repo, "src/ingest");
    mkdir(repo, "src/storage");
    write(repo, "CHARTER.md", `---
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
    assert.equal(result.inventory.claudeMdFound, true);
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
    assert.match(ingest.candidate_goal, /logging pipeline/);
    assert.match(ingest.candidate_goal, /O1/);
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
    assert.match(progressSync.candidate_scope, /Confirm the owning source surface/);
    assert.doesNotMatch(progressSync.candidate_scope, /src\/progress-sync/);
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
        repoRoot: "/x", readmeFound: false, claudeMdFound: false,
        sourceRoot: null, sourceDirCount: 0,
        commitsScanned: 0, commitScopeCount: 0, charterObjectiveCount: 0,
      },
      capabilities: [],
    };
    assert.match(formatHumanReport(result), /greenfield/);
  });

  it("renders capability candidates under the summary limit", () => {
    const result = {
      inventory: {
        repoRoot: "/x", readmeFound: true, claudeMdFound: false,
        sourceRoot: "src", sourceDirCount: 2,
        commitsScanned: 10, commitScopeCount: 2, charterObjectiveCount: 0,
      },
      capabilities: [
        { name: "auth",     signals: ["src/auth/", "commit-scope:auth (4)"],     candidate_goal: "", candidate_scope: "" },
        { name: "billing",  signals: ["src/billing/", "commit-scope:billing (2)"], candidate_goal: "", candidate_scope: "" },
      ],
    };
    const report = formatHumanReport(result);
    assert.match(report, /Capability candidates \(2/);
    assert.match(report, /functional contracts/);
    assert.match(report, /auth/);
    assert.match(report, /billing/);
  });
});
