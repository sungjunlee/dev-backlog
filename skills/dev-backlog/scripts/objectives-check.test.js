const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseArgs,
  parseFrontmatter,
  extractObjectivesField,
  parseSprintObjectives,
  parseCharterObjectives,
  listSprintFiles,
  findDrift,
  checkObjectives,
  formatReport,
} = require("./objectives-check.js");

const SAMPLE_CHARTER = `---
last_amended: 2026-05-23
revision: 1
---

# Charter

## Objectives
- O1 [validated] outcome one · src: user
- O2 [validated] outcome two · src: user
- O3 [active]    outcome three · src: user
- O4 [active]    outcome four · src: user
- O5 [deferred]  outcome five deferred to follow-up
- O6 [deferred]  outcome six deferred
`;

describe("parseArgs", () => {
  it("uses defaults when nothing passed", () => {
    const parsed = parseArgs([]);
    assert.equal(parsed.sprintsDir, path.join("backlog", "sprints"));
    assert.equal(parsed.charterPath, "CHARTER.md");
    assert.equal(parsed.json, false);
  });

  it("accepts --sprints-dir and --charter", () => {
    const parsed = parseArgs(["--sprints-dir", "x", "--charter", "y.md"]);
    assert.equal(parsed.sprintsDir, "x");
    assert.equal(parsed.charterPath, "y.md");
  });

  it("accepts the = form", () => {
    const parsed = parseArgs(["--sprints-dir=x", "--charter=y.md"]);
    assert.equal(parsed.sprintsDir, "x");
    assert.equal(parsed.charterPath, "y.md");
  });

  it("errors on missing value for --charter", () => {
    assert.match(parseArgs(["--charter"]).error, /Missing value for --charter/);
  });

  it("errors on unknown argument", () => {
    assert.match(parseArgs(["--bogus"]).error, /Unknown argument/);
  });
});

describe("parseFrontmatter", () => {
  it("returns inner block when frontmatter is present", () => {
    const fm = parseFrontmatter("---\na: 1\nb: 2\n---\nbody\n");
    assert.equal(fm, "a: 1\nb: 2");
  });

  it("returns null when no frontmatter", () => {
    assert.equal(parseFrontmatter("# heading\n"), null);
  });

  it("returns null on unclosed frontmatter", () => {
    assert.equal(parseFrontmatter("---\na: 1\n"), null);
  });
});

describe("extractObjectivesField", () => {
  it("parses bracketed list", () => {
    assert.deepEqual(extractObjectivesField("objectives: [O1, O3]"), ["O1", "O3"]);
  });

  it("ignores malformed entries", () => {
    assert.deepEqual(extractObjectivesField("objectives: [O1, foo, O2]"), ["O1", "O2"]);
  });

  it("returns empty list when field missing", () => {
    assert.deepEqual(extractObjectivesField("other: value"), []);
  });

  it("returns empty list for empty bracket", () => {
    assert.deepEqual(extractObjectivesField("objectives: []"), []);
  });
});

describe("parseSprintObjectives", () => {
  it("reads objectives from a sprint file's frontmatter", () => {
    const content = "---\nmilestone: x\nobjectives: [O3, O4]\n---\n\n# Sprint\n";
    assert.deepEqual(parseSprintObjectives(content), ["O3", "O4"]);
  });

  it("returns empty when frontmatter has no objectives line", () => {
    const content = "---\nmilestone: x\n---\n\n# Sprint\n";
    assert.deepEqual(parseSprintObjectives(content), []);
  });
});

describe("parseCharterObjectives", () => {
  it("builds id→status map from charter body", () => {
    const map = parseCharterObjectives(SAMPLE_CHARTER);
    assert.equal(map.get("O1"), "validated");
    assert.equal(map.get("O3"), "active");
    assert.equal(map.get("O5"), "deferred");
    assert.equal(map.size, 6);
  });

  it("returns empty map when no objectives lines present", () => {
    assert.equal(parseCharterObjectives("# Charter\n\nNo objectives here.").size, 0);
  });
});

describe("listSprintFiles", () => {
  it("returns sorted .md files only", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obj-check-list-"));
    try {
      fs.writeFileSync(path.join(dir, "b.md"), "");
      fs.writeFileSync(path.join(dir, "a.md"), "");
      fs.writeFileSync(path.join(dir, "ignore.txt"), "");
      const files = listSprintFiles(dir);
      assert.equal(files.length, 2);
      assert.equal(path.basename(files[0]), "a.md");
      assert.equal(path.basename(files[1]), "b.md");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns empty when sprintsDir does not exist", () => {
    assert.deepEqual(listSprintFiles("/no/such/dir"), []);
  });
});

describe("findDrift", () => {
  it("detects missing and deferred references per sprint", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obj-check-drift-"));
    try {
      fs.writeFileSync(
        path.join(dir, "a.md"),
        "---\nmilestone: a\nobjectives: [O1, O99]\n---\n",
      );
      fs.writeFileSync(
        path.join(dir, "b.md"),
        "---\nmilestone: b\nobjectives: [O5]\n---\n",
      );
      fs.writeFileSync(
        path.join(dir, "c.md"),
        "---\nmilestone: c\nobjectives: [O3, O4]\n---\n",
      );
      const charterObjectives = parseCharterObjectives(SAMPLE_CHARTER);
      const drift = findDrift(listSprintFiles(dir), charterObjectives);
      assert.equal(drift.length, 2);
      const byName = (f) => drift.find((d) => d.sprintFile.endsWith(f));
      assert.deepEqual(byName("a.md").missing, ["O99"]);
      assert.deepEqual(byName("a.md").deferred, []);
      assert.deepEqual(byName("b.md").missing, []);
      assert.deepEqual(byName("b.md").deferred, ["O5"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("checkObjectives", () => {
  it("returns charterFound:false when CHARTER.md is absent", () => {
    const result = checkObjectives({
      charterPath: "/no/such/CHARTER.md",
      fileExists: (p) => p !== "/no/such/CHARTER.md",
    });
    assert.equal(result.charterFound, false);
    assert.equal(result.drift.length, 0);
  });

  it("reports drift over real fixtures", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obj-check-full-"));
    try {
      const sprintsDir = path.join(dir, "backlog", "sprints");
      fs.mkdirSync(sprintsDir, { recursive: true });
      fs.writeFileSync(path.join(dir, "CHARTER.md"), SAMPLE_CHARTER);
      fs.writeFileSync(
        path.join(sprintsDir, "2026-05-x.md"),
        "---\nmilestone: x\nobjectives: [O3, O99]\n---\n",
      );
      const result = checkObjectives({
        sprintsDir,
        charterPath: path.join(dir, "CHARTER.md"),
      });
      assert.equal(result.charterFound, true);
      assert.equal(result.sprintCount, 1);
      assert.equal(result.drift.length, 1);
      assert.deepEqual(result.drift[0].missing, ["O99"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("formatReport", () => {
  it("renders absent-charter message", () => {
    const result = { charterFound: false, charterPath: "CHARTER.md", drift: [], sprintCount: 0 };
    assert.match(formatReport(result), /No CHARTER\.md/);
  });

  it("renders no-drift summary", () => {
    const result = {
      charterFound: true,
      charterObjectiveIds: ["O1", "O2"],
      sprintCount: 3,
      drift: [],
    };
    assert.match(formatReport(result), /No drift detected/);
  });

  it("renders drift listing", () => {
    const result = {
      charterFound: true,
      charterObjectiveIds: ["O1", "O2"],
      sprintCount: 2,
      drift: [{ sprintFile: "a.md", missing: ["O99"], deferred: ["O5"] }],
    };
    const report = formatReport(result);
    assert.match(report, /Drift detected/);
    assert.match(report, /missing: O99/);
    assert.match(report, /deferred: O5/);
  });
});
