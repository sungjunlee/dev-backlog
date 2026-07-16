const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseArgs,
  countLines,
  parseCapabilityBlocks,
  analyzeLearnings,
  analyzeCapabilities,
  hasHardFailures,
  formatReport,
} = require("./capabilities-doctor.js");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cap-doctor-"));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function capability(name, learnings = []) {
  return `## Capability: ${name}

**Goal:** ${name} works.

**In-scope:**
- one thing

**Out-of-scope:**
- another thing

### Expected Behaviors
- behavior one
- behavior two
- behavior three

### Hard Constraints
- constraint one
- constraint two

### Learnings
<!-- LEARN:BEGIN -->
${learnings.map((entry) => `- ${entry}`).join("\n")}
<!-- LEARN:END -->

### Decisions
| date | decision | rationale | supersedes |
| --- | --- | --- | --- |
`;
}

describe("parseArgs", () => {
  it("uses defaults", () => {
    const parsed = parseArgs([]);
    assert.equal(parsed.capabilitiesPath, path.join("spec", "capabilities.md"));
    assert.equal(parsed.json, false);
    assert.equal(parsed.strict, false);
  });

  it("accepts capabilities, json, and strict flags", () => {
    const parsed = parseArgs(["--capabilities", "x.md", "--json", "--strict"]);
    assert.equal(parsed.capabilitiesPath, "x.md");
    assert.equal(parsed.json, true);
    assert.equal(parsed.strict, true);
  });

  it("errors on missing capabilities value", () => {
    assert.match(parseArgs(["--capabilities"]).error, /Missing value/);
  });
});

describe("countLines", () => {
  it("counts empty and non-empty content", () => {
    assert.equal(countLines(""), 0);
    assert.equal(countLines("a\nb"), 2);
  });
});

describe("parseCapabilityBlocks", () => {
  it("extracts capability blocks with line ranges", () => {
    const blocks = parseCapabilityBlocks(`# X

${capability("one")}

${capability("two")}
`);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].name, "one");
    assert.equal(blocks[1].name, "two");
    assert.ok(blocks[0].lines.length > 0);
  });
});

describe("analyzeLearnings", () => {
  it("counts inline Learning entries between markers", () => {
    const lines = capability("one", ["2026-05-24: a", "2026-05-25: b"]).split("\n");
    const result = analyzeLearnings(lines);
    assert.equal(result.hasBegin, true);
    assert.equal(result.hasEnd, true);
    assert.equal(result.learningCount, 2);
    assert.equal(result.malformed, false);
  });

  it("flags malformed markers", () => {
    const result = analyzeLearnings(["### Learnings", "<!-- LEARN:BEGIN -->"]);
    assert.equal(result.malformed, true);
    assert.equal(result.hasBegin, true);
    assert.equal(result.hasEnd, false);
  });
});

describe("analyzeCapabilities", () => {
  it("returns found:false when spec/capabilities.md is absent", () => {
    const result = analyzeCapabilities({ capabilitiesPath: "/no/such/file.md" });
    assert.equal(result.found, false);
    assert.equal(result.structuralOnly, true);
    assert.equal(result.coverage, "not_assessed");
    assert.equal(result.capabilityCount, 0);
    assert.equal(hasHardFailures(result), false);
  });

  it("serializes a Windows-style capabilities path with forward slashes", () => {
    const result = analyzeCapabilities({
      capabilitiesPath: "C:\\repo\\spec\\capabilities.md",
      fileExists: () => false,
    });
    assert.equal(result.capabilitiesPath, "C:/repo/spec/capabilities.md");
  });

  it("accepts a compact clean capabilities file", () => {
    const dir = makeTempDir();
    try {
      const capPath = path.join(dir, "spec", "capabilities.md");
      write(capPath, `# Caps

${capability("sprint-execution")}
${capability("backlog-sync")}
`);
      const result = analyzeCapabilities({ capabilitiesPath: capPath });
      assert.equal(result.found, true);
      assert.equal(result.structuralOnly, true);
      assert.equal(result.coverage, "not_assessed");
      assert.equal(result.capabilityCount, 2);
      assert.deepEqual(result.warnings, []);
      assert.deepEqual(result.hardFailures, []);
      assert.match(formatReport(result), /hygiene/);
      assert.match(formatReport(result), /Coverage: not assessed/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns for too many capabilities without hard-failing below the hard budget", () => {
    const dir = makeTempDir();
    try {
      const capPath = path.join(dir, "spec", "capabilities.md");
      const content = Array.from({ length: 13 }, (_, i) => capability(`cap-${i}`)).join("\n");
      write(capPath, content);
      const result = analyzeCapabilities({ capabilitiesPath: capPath });
      assert.equal(result.capabilityCount, 13);
      assert.match(result.warnings.join("\n"), /soft budget/);
      assert.equal(hasHardFailures(result), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hard-fails for split-trigger capability count", () => {
    const dir = makeTempDir();
    try {
      const capPath = path.join(dir, "spec", "capabilities.md");
      const content = Array.from({ length: 16 }, (_, i) => capability(`cap-${i}`)).join("\n");
      write(capPath, content);
      const result = analyzeCapabilities({ capabilitiesPath: capPath });
      assert.equal(result.capabilityCount, 16);
      assert.match(result.hardFailures.join("\n"), /hard budget/);
      assert.equal(hasHardFailures(result), true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("warns when Learnings exceed the inline budget", () => {
    const dir = makeTempDir();
    try {
      const capPath = path.join(dir, "spec", "capabilities.md");
      const learnings = Array.from({ length: 8 }, (_, i) => `2026-05-${i + 1}: finding`);
      write(capPath, capability("charter-management", learnings));
      const result = analyzeCapabilities({ capabilitiesPath: capPath });
      assert.match(result.warnings.join("\n"), /8 inline Learnings/);
      assert.equal(hasHardFailures(result), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hard-fails malformed Learning markers", () => {
    const dir = makeTempDir();
    try {
      const capPath = path.join(dir, "spec", "capabilities.md");
      write(capPath, `## Capability: broken

### Learnings
<!-- LEARN:BEGIN -->
`);
      const result = analyzeCapabilities({ capabilitiesPath: capPath });
      assert.match(result.hardFailures.join("\n"), /malformed Learnings markers/);
      assert.equal(hasHardFailures(result), true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("hard-fails tamgu-style feature-folder explosion", () => {
    const dir = makeTempDir();
    try {
      const capPath = path.join(dir, "spec", "capabilities.md");
      const names = [
        "activity", "ai", "insight", "child", "family", "auth", "onboarding", "search",
        "settings", "sync", "storage", "e2e", "test", "sprint", "backlog", "premium",
      ];
      write(capPath, names.map((name) => capability(name)).join("\n"));
      const result = analyzeCapabilities({ capabilitiesPath: capPath });
      assert.equal(result.capabilityCount, 16);
      assert.match(result.hardFailures.join("\n"), /16 capabilities/);
      assert.match(result.recommendations.join("\n"), /split|compact/i);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CLI emits JSON and strict exits non-zero on hard triggers", () => {
    const dir = makeTempDir();
    try {
      const capPath = path.join(dir, "spec", "capabilities.md");
      const names = Array.from({ length: 16 }, (_, i) => `cap-${i}`);
      write(capPath, names.map((name) => capability(name)).join("\n"));

      const jsonRun = spawnSync(
        process.execPath,
        [__filename.replace(/\.test\.js$/, ".js"), "--capabilities", capPath, "--json"],
        { encoding: "utf-8" },
      );
      assert.equal(jsonRun.status, 0);
      const parsed = JSON.parse(jsonRun.stdout);
      assert.equal(parsed.capabilityCount, 16);
      assert.equal(parsed.structuralOnly, true);
      assert.equal(parsed.coverage, "not_assessed");

      const strictRun = spawnSync(
        process.execPath,
        [__filename.replace(/\.test\.js$/, ".js"), "--capabilities", capPath, "--strict"],
        { encoding: "utf-8" },
      );
      assert.equal(strictRun.status, 1);
      assert.match(strictRun.stdout, /Hard triggers/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
