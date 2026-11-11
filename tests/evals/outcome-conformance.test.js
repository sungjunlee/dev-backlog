const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  SCENARIOS,
  GUARANTEES,
  CLOSE_SPRINT_PATH,
  CLOSE_SPRINT_SOURCE,
  sprintCore,
  snapshotTree,
  diffSnapshots,
  parseExpectedChange,
  parseArgs,
  gradeScenario,
  outcomeSignature,
  mutationCalls,
} = require("./outcome-conformance.js");
const { installConformanceCliFixture } = require("../fakes/conformance-cli-fixture.js");

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

describe("read-only and bounded graders", () => {
  const scenario = (id) => SCENARIOS.find((item) => item.id === id);

  function tmpContext(files, invocations) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-grade-"));
    for (const [relative, content] of Object.entries(files)) {
      const absolute = path.join(root, relative);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, content);
    }
    return { root, invocations, changes: [], runnerStatus: 0 };
  }

  it("fails orientation when a GitHub write occurs without local file changes", () => {
    const context = tmpContext({}, [
      { command: "gh", args: ["issue", "view", "3", "--json", "title"], status: 0 },
      { command: "node", args: ["skills/dev-backlog/scripts/status.sh", "--json"], status: 0 },
      { command: "gh", args: ["issue", "close", "99"], status: 0 },
    ]);
    try {
      const outcome = gradeScenario(scenario("orient-next-batch"), context);
      assert.equal(outcome.pass, false);
      assert.equal(outcome.checks.find((item) => item.name.includes("no authority mutation")).pass, false);
    } finally {
      fs.rmSync(context.root, { recursive: true, force: true });
    }
  });

  it("fails a Backlog direct read when a Backlog edit is recorded", () => {
    const context = tmpContext({ ".dev-backlog/.tracker": "backlog\n" }, [
      { command: "backlog", args: ["task", "7", "--plain"], status: 0 },
      { command: "backlog", args: ["task", "edit", "7", "-s", "Done"], status: 0 },
    ]);
    try {
      const outcome = gradeScenario(scenario("backlog-authority-direct-read"), context);
      assert.equal(outcome.pass, false);
      assert.equal(outcome.checks.find((item) => item.name.includes("no Backlog or GitHub mutation")).pass, false);
    } finally {
      fs.rmSync(context.root, { recursive: true, force: true });
    }
  });

  it("fails close when the Plan is rewritten even if status and Progress look right", () => {
    const closed = sprintCore(CLOSE_SPRINT_SOURCE).replace("status: <ignored>", "status: completed")
      .replace("## Progress\n<ignored>\n", "## Progress\n- 2026-11-12: Sprint closed. 1/1 tasks completed.\n")
      .replace("- [x] #20 Done", "- [x] #999 Rewritten");
    // simpler: start from completed legal text and rewrite Plan
    const legal = CLOSE_SPRINT_SOURCE
      .replace(/^status: active$/m, "status: completed")
      + "- 2026-11-12: Sprint closed. 1/1 tasks completed.\n";
    const rewritten = legal.replace("- [x] #20 Done", "- [x] #999 Rewritten");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-close-"));
    try {
      fs.mkdirSync(path.join(root, path.dirname(CLOSE_SPRINT_PATH)), { recursive: true });
      fs.writeFileSync(path.join(root, CLOSE_SPRINT_PATH), rewritten);
      fs.writeFileSync(path.join(root, "operator-owned.txt"), "keep\n");
      const context = {
        root,
        invocations: [{ command: "bash", args: ["skills/dev-backlog/scripts/sprint-close.sh"], status: 0 }],
        changes: [{ path: CLOSE_SPRINT_PATH, kind: "modified", before: "aa", after: "bb" }],
        runnerStatus: 0,
      };
      const outcome = gradeScenario(scenario("close-sprint-bounded-effects"), context);
      assert.equal(sprintCore(rewritten) === sprintCore(CLOSE_SPRINT_SOURCE), false);
      assert.equal(outcome.checks.find((item) => item.name === "only status and Progress content changed").pass, false);
      assert.equal(outcome.pass, false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes close when only status and Progress change, and includes content hashes in the signature", () => {
    const legal = CLOSE_SPRINT_SOURCE.replace(/^status: active$/m, "status: completed")
      + "- 2026-11-12: Sprint closed. 1/1 tasks completed.\n";
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-close-ok-"));
    try {
      fs.mkdirSync(path.join(root, path.dirname(CLOSE_SPRINT_PATH)), { recursive: true });
      fs.writeFileSync(path.join(root, CLOSE_SPRINT_PATH), legal);
      fs.writeFileSync(path.join(root, "operator-owned.txt"), "keep\n");
      const context = {
        root,
        invocations: [{ command: "bash", args: ["skills/dev-backlog/scripts/sprint-close.sh"], status: 0 }],
        changes: [{ path: CLOSE_SPRINT_PATH, kind: "modified", before: "aa", after: "bb" }],
        runnerStatus: 0,
      };
      const outcome = gradeScenario(scenario("close-sprint-bounded-effects"), context);
      assert.equal(outcome.checks.find((item) => item.name === "only status and Progress content changed").pass, true);
      assert.equal(outcome.pass, true);
      const signed = outcomeSignature(outcome);
      assert.deepEqual(signed.changes, context.changes);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("runner environment isolation", () => {
  it("does not inherit parent credentials or startup hooks into the runner env", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-env-"));
    const previous = {
      NODE_OPTIONS: process.env.NODE_OPTIONS,
      BASH_ENV: process.env.BASH_ENV,
      GITHUB_ENTERPRISE_TOKEN: process.env.GITHUB_ENTERPRISE_TOKEN,
      GH_TOKEN: process.env.GH_TOKEN,
    };
    try {
      process.env.NODE_OPTIONS = "--require=/tmp/sentinel-preload.js";
      process.env.BASH_ENV = "/tmp/sentinel.bashrc";
      process.env.GITHUB_ENTERPRISE_TOKEN = "sentinel-enterprise-token";
      process.env.GH_TOKEN = "sentinel-gh-token";
      const cli = installConformanceCliFixture(root, { ghMode: "ok" });
      assert.equal("NODE_OPTIONS" in cli.env, false);
      assert.equal("BASH_ENV" in cli.env, false);
      assert.equal("GITHUB_ENTERPRISE_TOKEN" in cli.env, false);
      assert.equal("GH_TOKEN" in cli.env, false);
      assert.deepEqual(Object.keys(cli.shellEnv).sort(), [
        "CONFORMANCE_GH_MODE",
        "CONFORMANCE_INVOCATION_LOG",
        "CONFORMANCE_REAL_BASH",
        "CONFORMANCE_REAL_NODE",
        "PATH",
      ]);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
