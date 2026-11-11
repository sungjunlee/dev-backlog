const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  SCENARIOS,
  GUARANTEES,
  snapshotTree,
  diffSnapshots,
  parseExpectedChange,
  parseArgs,
  outcomeSignature,
} = require("./outcome-conformance.js");

const STATIC_OUTCOME_TESTS = new Set(["triage-apply-github-only"]);
const scenarioIds = new Set(SCENARIOS.map((scenario) => scenario.id));

for (const guarantee of GUARANTEES) {
  it(`outcome map ${guarantee.id}: ${guarantee.text}`, () => {
    assert.ok(guarantee.tests.length > 0, `${guarantee.id} must name outcome evidence`);
    for (const test of guarantee.tests) {
      assert.ok(scenarioIds.has(test) || STATIC_OUTCOME_TESTS.has(test),
        `${guarantee.id} names unknown outcome test ${test}`);
    }
  });
}

describe("outcome evidence", () => {
  it("detects added, modified, and removed files without inspecting answer wording", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-snapshot-"));
    try {
      fs.writeFileSync(path.join(root, "kept.txt"), "before\n");
      fs.writeFileSync(path.join(root, "removed.txt"), "remove\n");
      const before = snapshotTree(root);
      fs.writeFileSync(path.join(root, "kept.txt"), "after\n");
      fs.rmSync(path.join(root, "removed.txt"));
      fs.writeFileSync(path.join(root, "added.txt"), "add\n");
      const changes = diffSnapshots(before, snapshotTree(root));
      assert.deepEqual(changes.map(({ path: file, kind }) => [file, kind]), [
        ["added.txt", "added"],
        ["kept.txt", "modified"],
        ["removed.txt", "removed"],
      ]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("signs invocations, file changes, and check results but not model prose", () => {
    const base = {
      checks: [{ name: "stopped", pass: true, observed: "first explanation" }],
      invocations: [{ command: "gh", args: ["issue", "view", "42"], status: 1 }],
      changes: [],
    };
    assert.deepEqual(
      outcomeSignature(base),
      outcomeSignature({
        ...base,
        checks: [{ name: "stopped", pass: true, observed: "different explanation" }],
      })
    );
  });
});

describe("intentional behavior changes", () => {
  it("requires a scenario and issue number for an expected-change marker", () => {
    assert.deepEqual(parseExpectedChange("close-sprint-bounded-effects=#498"), {
      scenario: "close-sprint-bounded-effects",
      issue: "#498",
    });
    for (const invalid of ["close-sprint-bounded-effects", "close=#next", "=#498"]) {
      assert.throws(() => parseExpectedChange(invalid), /scenario-id=#N/);
    }
  });

  it("rejects duplicate expected-change markers", () => {
    assert.throws(() => parseArgs([
      "--output", "out",
      "--expect-change", "close-sprint-bounded-effects=#498",
      "--expect-change", "close-sprint-bounded-effects=#499",
    ]), /Duplicate expected change/);
  });
});
