const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
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
} = require("./component-lint.js");

const SAMPLE_CAPABILITIES = `# Project Capabilities

## Capability: sprint-execution
Goal etc.

## Capability: backlog-sync
Goal etc.

## Capability: charter-management
Goal etc.
`;

describe("parseArgs", () => {
  it("uses defaults", () => {
    const parsed = parseArgs([]);
    assert.equal(parsed.sprintsDir, path.join("backlog", "sprints"));
    assert.equal(parsed.capabilitiesPath, path.join("spec", "capabilities.md"));
    assert.equal(parsed.json, false);
  });

  it("accepts --sprints-dir and --capabilities", () => {
    const parsed = parseArgs(["--sprints-dir", "x", "--capabilities", "y.md"]);
    assert.equal(parsed.sprintsDir, "x");
    assert.equal(parsed.capabilitiesPath, "y.md");
  });

  it("accepts the = form", () => {
    const parsed = parseArgs(["--sprints-dir=x", "--capabilities=y.md"]);
    assert.equal(parsed.sprintsDir, "x");
    assert.equal(parsed.capabilitiesPath, "y.md");
  });

  it("errors on missing value for --capabilities", () => {
    assert.match(parseArgs(["--capabilities"]).error, /Missing value/);
  });

  it("errors on unknown argument", () => {
    assert.match(parseArgs(["--bogus"]).error, /Unknown argument/);
  });
});

describe("parseFrontmatter", () => {
  it("returns inner block when present", () => {
    assert.equal(parseFrontmatter("---\na: 1\n---\nbody"), "a: 1");
  });

  it("returns null when no frontmatter", () => {
    assert.equal(parseFrontmatter("# heading"), null);
  });

  it("returns null on unclosed frontmatter", () => {
    assert.equal(parseFrontmatter("---\nfoo: bar\n"), null);
  });
});

describe("parseComponentField", () => {
  it("returns single-value array for a plain string", () => {
    assert.deepEqual(parseComponentField('component: sprint-execution'), ["sprint-execution"]);
  });

  it("strips surrounding double quotes", () => {
    assert.deepEqual(parseComponentField('component: "sprint-execution"'), ["sprint-execution"]);
  });

  it("strips surrounding single quotes", () => {
    assert.deepEqual(parseComponentField("component: 'sprint-execution'"), ["sprint-execution"]);
  });

  it("returns empty array on empty value", () => {
    assert.deepEqual(parseComponentField('component: ""'), []);
    assert.deepEqual(parseComponentField('component:'), []);
  });

  it("splits comma-separated multi-component values", () => {
    assert.deepEqual(
      parseComponentField("component: sprint-execution, backlog-sync"),
      ["sprint-execution", "backlog-sync"],
    );
  });

  it("returns empty array when no component line", () => {
    assert.deepEqual(parseComponentField("milestone: x\nobjectives: []"), []);
  });
});

describe("parseSprintComponents", () => {
  it("reads component from a sprint file's frontmatter", () => {
    const content = "---\nmilestone: x\ncomponent: sprint-execution\n---\nbody";
    assert.deepEqual(parseSprintComponents(content), ["sprint-execution"]);
  });

  it("returns empty when sprint has no component line", () => {
    assert.deepEqual(parseSprintComponents("---\nmilestone: x\n---\nbody"), []);
  });
});

describe("parseCapabilityNames", () => {
  it("collects all ## Capability: <name> headers", () => {
    const names = parseCapabilityNames(SAMPLE_CAPABILITIES);
    assert.equal(names.size, 3);
    assert.ok(names.has("sprint-execution"));
    assert.ok(names.has("backlog-sync"));
    assert.ok(names.has("charter-management"));
  });

  it("returns empty set when no Capability headers", () => {
    assert.equal(parseCapabilityNames("# Just a heading").size, 0);
  });
});

describe("listSprintFiles", () => {
  it("returns sorted .md files; skips _context.md", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comp-lint-list-"));
    try {
      fs.writeFileSync(path.join(dir, "b.md"), "");
      fs.writeFileSync(path.join(dir, "a.md"), "");
      fs.writeFileSync(path.join(dir, "_context.md"), "");
      fs.writeFileSync(path.join(dir, "ignore.txt"), "");
      const files = listSprintFiles(dir);
      assert.equal(files.length, 2);
      assert.equal(path.basename(files[0]), "a.md");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty when dir is missing", () => {
    assert.deepEqual(listSprintFiles("/no/such/dir"), []);
  });
});

describe("classifyComponents", () => {
  const declared = new Set(["sprint-execution", "backlog-sync", "charter-management"]);

  it("returns empty errors/warnings for empty input", () => {
    assert.deepEqual(classifyComponents([], declared), { errors: [], warnings: [] });
  });

  it("primary unknown is an error", () => {
    const r = classifyComponents(["unknown-cap"], declared);
    assert.deepEqual(r.errors, ["unknown-cap"]);
    assert.deepEqual(r.warnings, []);
  });

  it("primary known is silent", () => {
    const r = classifyComponents(["sprint-execution"], declared);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  });

  it("secondary known is a warning per D4 (first-wins)", () => {
    const r = classifyComponents(["sprint-execution", "backlog-sync"], declared);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, ["backlog-sync"]);
  });

  it("secondary unknown is an error AND signals a typo", () => {
    const r = classifyComponents(["sprint-execution", "typo-cap"], declared);
    assert.deepEqual(r.errors, ["typo-cap"]);
    assert.deepEqual(r.warnings, []);
  });
});

describe("findIssues", () => {
  it("flags only sprints whose component fails to resolve", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comp-lint-find-"));
    try {
      fs.writeFileSync(path.join(dir, "ok.md"), "---\ncomponent: sprint-execution\n---\n");
      fs.writeFileSync(path.join(dir, "bad.md"), "---\ncomponent: typo-cap\n---\n");
      fs.writeFileSync(path.join(dir, "multi.md"), "---\ncomponent: sprint-execution, backlog-sync\n---\n");
      fs.writeFileSync(path.join(dir, "noop.md"), "---\nmilestone: x\n---\n");

      const declared = parseCapabilityNames(SAMPLE_CAPABILITIES);
      const issues = findIssues(listSprintFiles(dir), declared);
      assert.equal(issues.length, 2);

      const byName = (name) => issues.find((i) => i.sprintFile.endsWith(name));
      assert.deepEqual(byName("bad.md").unknown, ["typo-cap"]);
      assert.deepEqual(byName("multi.md").secondary, ["backlog-sync"]);
      assert.deepEqual(byName("multi.md").unknown, []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("lintComponents", () => {
  it("returns capabilitiesFound:false when spec/capabilities.md is absent", () => {
    const result = lintComponents({
      capabilitiesPath: "/no/such/spec/capabilities.md",
      fileExists: (p) => p !== "/no/such/spec/capabilities.md",
    });
    assert.equal(result.capabilitiesFound, false);
    assert.equal(result.issues.length, 0);
  });

  it("flags real fixture drift end-to-end", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "comp-lint-full-"));
    try {
      const sprintsDir = path.join(dir, "backlog", "sprints");
      const capPath = path.join(dir, "spec", "capabilities.md");
      fs.mkdirSync(sprintsDir, { recursive: true });
      fs.mkdirSync(path.dirname(capPath), { recursive: true });
      fs.writeFileSync(capPath, SAMPLE_CAPABILITIES);
      fs.writeFileSync(
        path.join(sprintsDir, "2026-05-x.md"),
        "---\ncomponent: typo-cap\n---\nbody",
      );
      const result = lintComponents({ sprintsDir, capabilitiesPath: capPath });
      assert.equal(result.capabilitiesFound, true);
      assert.equal(result.declaredCapabilities.length, 3);
      assert.equal(result.issues.length, 1);
      assert.deepEqual(result.issues[0].unknown, ["typo-cap"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("hasErrors", () => {
  it("true when any issue has unknown components", () => {
    assert.equal(hasErrors({ issues: [{ unknown: ["x"], secondary: [] }] }), true);
  });

  it("false when only warnings", () => {
    assert.equal(hasErrors({ issues: [{ unknown: [], secondary: ["y"] }] }), false);
  });

  it("false when no issues", () => {
    assert.equal(hasErrors({ issues: [] }), false);
  });
});

describe("formatReport", () => {
  it("renders absent-spec message", () => {
    const result = { capabilitiesFound: false, capabilitiesPath: "spec/capabilities.md", issues: [], sprintCount: 0 };
    assert.match(formatReport(result), /No spec\/capabilities\.md/);
  });

  it("renders clean summary", () => {
    const result = {
      capabilitiesFound: true,
      capabilitiesPath: "spec/capabilities.md",
      declaredCapabilities: ["a", "b"],
      sprintCount: 3,
      issues: [],
    };
    assert.match(formatReport(result), /All component values resolve/);
  });

  it("renders issue listing with errors and warnings", () => {
    const result = {
      capabilitiesFound: true,
      capabilitiesPath: "spec/capabilities.md",
      declaredCapabilities: ["a", "b"],
      sprintCount: 2,
      issues: [{ sprintFile: "x.md", components: ["typo", "b"], unknown: ["typo"], secondary: [] }],
    };
    const report = formatReport(result);
    assert.match(report, /unknown component\(s\): typo/);
  });
});
