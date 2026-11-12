const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
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
  applyComparison,
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

  it("accepts an explicit pinned Backlog.md executable", () => {
    assert.equal(parseArgs([
      "--output", "out",
      "--backlog-bin", "/tmp/backlog-1.50.1/bin/backlog",
    ]).backlogBin, "/tmp/backlog-1.50.1/bin/backlog");
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
      { command: "node", args: ["skills/dev-backlog/scripts/sprint-state.js", "--mode", "status"], status: 0 },
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

  it("grades fresh planning through sprint-init and rejects legacy setup", () => {
    const sprintPath = ".dev-backlog/sprints/2026-11-fresh.md";
    const context = tmpContext({
      [sprintPath]: [
        "---", "status: active", "scope: [\"src/fresh/**\"]", "---", "",
        "# fresh", "", "## Goal", "", "## Plan", "", "## Running Context", "", "## Progress", "",
      ].join("\n"),
    }, [
      { command: "node", args: ["skills/dev-backlog/scripts/sprint-init.js", "fresh", "--scope", "src/fresh/**"], status: 0 },
    ]);
    try {
      let outcome = gradeScenario(scenario("fresh-repository-plan"), context);
      assert.equal(outcome.pass, true);
      context.invocations.push({
        command: "node",
        args: ["skills/dev-backlog/scripts/setup-dev-backlog.js", "--migrate-legacy"],
        status: 0,
      });
      outcome = gradeScenario(scenario("fresh-repository-plan"), context);
      assert.equal(outcome.checks.find((item) => item.name.includes("does not invoke legacy migration")).pass, false);
      assert.equal(outcome.pass, false);
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

  it("grades the controlled GitHub create/read/close lifecycle from invocations", () => {
    const lifecycle = [
      { command: "gh", args: ["issue", "create", "--title", "Controlled lifecycle", "--body", "## Acceptance criteria\n- [ ] lifecycle is observed"], status: 0 },
      { command: "gh", args: ["issue", "view", "77", "--json", "body,comments"], status: 0 },
      { command: "gh", args: ["issue", "close", "77"], status: 0 },
    ];
    const context = tmpContext({}, lifecycle);
    try {
      let outcome = gradeScenario(scenario("github-authority-lifecycle"), context);
      assert.equal(outcome.pass, true);
      context.invocations.push({ command: "gh", args: ["issue", "comment", "77", "--body", "extra"], status: 0 });
      outcome = gradeScenario(scenario("github-authority-lifecycle"), context);
      assert.equal(outcome.pass, false);
      assert.equal(outcome.checks.find((item) => item.name.includes("only the requested")).pass, false);
    } finally {
      fs.rmSync(context.root, { recursive: true, force: true });
    }
  });

  it("rejects a GitHub lifecycle that also invokes Backlog, whether that extra call succeeds or fails", () => {
    const lifecycle = [
      { command: "gh", args: ["issue", "create", "--title", "Controlled lifecycle", "--body", "## Acceptance criteria\n- [ ] lifecycle is observed"], status: 0 },
      { command: "gh", args: ["issue", "view", "77", "--json", "body,comments"], status: 0 },
      { command: "gh", args: ["issue", "close", "77"], status: 0 },
    ];
    for (const extra of [
      { command: "backlog", args: ["task", "edit", "7", "-s", "Done"], status: 0 },
      { command: "backlog", args: ["task", "edit", "7", "-s", "Done"], status: 93 },
    ]) {
      const context = tmpContext({}, [...lifecycle, extra]);
      try {
        const outcome = gradeScenario(scenario("github-authority-lifecycle"), context);
        assert.equal(outcome.pass, false);
        assert.equal(outcome.checks.find((item) => item.name.includes("no Backlog authority")).pass, false);
      } finally {
        fs.rmSync(context.root, { recursive: true, force: true });
      }
    }
  });

  it("grades non-GitHub triage refusal before provider or file effects", () => {
    const refusal = {
      command: "node",
      args: ["skills/backlog-triage/scripts/triage-apply.js", "refused.md", "--apply", "--yes"],
      status: 1,
      stderr: "Cannot apply triage actions: task authority is \"backlog\"; triage apply requires github.\n",
    };
    const context = tmpContext({ ".dev-backlog/.tracker": "backlog\n" }, [refusal]);
    try {
      let outcome = gradeScenario(scenario("triage-non-github-refused"), context);
      assert.equal(outcome.pass, true);
      context.invocations.push({ command: "gh", args: ["issue", "close", "31"], status: 0 });
      outcome = gradeScenario(scenario("triage-non-github-refused"), context);
      assert.equal(outcome.pass, false);
      assert.equal(outcome.checks.find((item) => item.name.includes("before any provider")).pass, false);
    } finally {
      fs.rmSync(context.root, { recursive: true, force: true });
    }
  });

  it("does not treat argument errors, a missing report, or a different script as a non-GitHub authority refusal", () => {
    const diagnostic = "Cannot apply triage actions: task authority is \"backlog\"; triage apply requires github.\n";
    const tracker = { ".dev-backlog/.tracker": "backlog\n" };
    const cases = [
      {
        command: "node",
        args: ["skills/backlog-triage/scripts/triage-apply.js", "refused.md", "--apply", "--yes", "--bogus"],
        status: 1,
        stderr: "Unknown argument: --bogus\n",
      },
      {
        command: "node",
        args: ["skills/backlog-triage/scripts/triage-apply.js", "missing.md", "--apply", "--yes"],
        status: 1,
        stderr: diagnostic,
      },
      {
        command: "node",
        args: ["skills/backlog-triage/scripts/other-apply.js", "refused.md", "--apply", "--yes"],
        status: 1,
        stderr: diagnostic,
      },
    ];
    for (const invocation of cases) {
      const context = tmpContext(tracker, [invocation]);
      try {
        const outcome = gradeScenario(scenario("triage-non-github-refused"), context);
        assert.equal(outcome.pass, false, invocation.args.join(" "));
        assert.equal(
          outcome.checks.find((item) => item.name.includes("refused the non-GitHub authority")).pass,
          false,
          invocation.args.join(" "),
        );
      } finally {
        fs.rmSync(context.root, { recursive: true, force: true });
      }
    }
  });

  it("accepts supported triage-apply argument order and --json as a non-GitHub refusal", () => {
    const diagnostic = "Cannot apply triage actions: task authority is \"backlog\"; triage apply requires github.\n";
    const tracker = { ".dev-backlog/.tracker": "backlog\n" };
    const cases = [
      ["skills/backlog-triage/scripts/triage-apply.js", "refused.md", "--apply", "--yes", "--json"],
      ["skills/backlog-triage/scripts/triage-apply.js", "--apply", "--yes", "refused.md"],
      ["skills/backlog-triage/scripts/triage-apply.js", "--json", "--apply", "refused.md", "--yes"],
    ];
    for (const args of cases) {
      const context = tmpContext(tracker, [{
        command: "node",
        args,
        status: 1,
        stderr: diagnostic,
      }]);
      try {
        const outcome = gradeScenario(scenario("triage-non-github-refused"), context);
        assert.equal(outcome.pass, true, args.join(" "));
      } finally {
        fs.rmSync(context.root, { recursive: true, force: true });
      }
    }
  });

  it("grades the real Backlog.md create/read/Done/read lifecycle and task-file effect", () => {
    const taskPath = "backlog/tasks/task-1 - Controlled-local-lifecycle.md";
    const context = tmpContext({
      ".dev-backlog/.tracker": "backlog\n",
      [taskPath]: "---\nid: task-1\ntitle: Controlled local lifecycle\nstatus: Done\n---\n",
    }, [
      { command: "backlog", args: ["task", "create", "Controlled local lifecycle", "-d", "Exercise local authority", "--ac", "Lifecycle is complete", "--plain"], status: 0 },
      { command: "backlog", args: ["task", "1", "--plain"], status: 0 },
      { command: "backlog", args: ["task", "edit", "TASK-1", "-s", "Done"], status: 0 },
      { command: "backlog", args: ["task", "task-1", "--plain"], status: 0 },
    ]);
    context.changes = [{ path: taskPath, kind: "added", after: "digest" }];
    try {
      const outcome = gradeScenario(scenario("backlog-authority-lifecycle"), context);
      assert.equal(outcome.pass, true);
      assert.equal(outcome.checks.every((item) => item.pass), true);
    } finally {
      fs.rmSync(context.root, { recursive: true, force: true });
    }
  });

  it("keeps omitted or duplicated triage reports failed through comparison", () => {
    const comparisonRoot = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-triage-compare-"));
    const baselinePath = path.join(comparisonRoot, "baseline.json");
    fs.writeFileSync(baselinePath, JSON.stringify({ scenarios: [] }));
    const applyCall = (report, status) => ({
      command: "node",
      args: ["skills/backlog-triage/scripts/triage-apply.js", report, "--apply", "--yes"],
      status,
    });
    const variants = [
      [applyCall("accepted.md", 0), applyCall("unchecked.md", 0), applyCall("invalid.md", 1), applyCall("invalid.md", 1)],
      [applyCall("accepted.md", 0), applyCall("unchecked.md", 0), applyCall("outside.md", 1), applyCall("outside.md", 1)],
    ];

    try {
      for (const invocations of variants) {
        const context = tmpContext({}, [
          ...invocations,
          { command: "gh", args: ["issue", "comment", "21", "-b", "triage: revisit — needs owner"], status: 0 },
        ]);
        try {
          const outcome = gradeScenario(scenario("triage-human-gate"), context);
          assert.equal(outcome.pass, false);
          assert.equal(outcome.checks.find((item) => item.name === "each named report exercised exactly once").pass, false);
          assert.equal(applyComparison([outcome], {
            compare: baselinePath,
            expectedChanges: new Map(),
          })[0].status, "FAIL");
          assert.throws(() => applyComparison([outcome], {
            compare: baselinePath,
            expectedChanges: new Map([["triage-human-gate", "#502"]]),
          }), /Unused --expect-change marker: triage-human-gate/);
        } finally {
          fs.rmSync(context.root, { recursive: true, force: true });
        }
      }
    } finally {
      fs.rmSync(comparisonRoot, { recursive: true, force: true });
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
        invocations: [{ command: "node", args: ["skills/dev-backlog/scripts/sprint-state.js", "--mode", "status"], status: 0 }],
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
        invocations: [{ command: "node", args: ["skills/dev-backlog/scripts/sprint-state.js", "--mode", "status"], status: 0 }],
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

  it("fails orientation on an unrecognized authority write verb or long-form API method", () => {
    const baseFiles = {};
    const reads = [
      { command: "gh", args: ["issue", "view", "3", "--json", "title"], status: 0 },
      { command: "node", args: ["skills/dev-backlog/scripts/sprint-state.js", "--mode", "status"], status: 0 },
    ];
    for (const extraCall of [
      { command: "gh", args: ["issue", "reopen", "99"], status: 93 },
      { command: "gh", args: ["api", "repos/owner/repo/issues/99", "--method", "PATCH", "-f", "state=closed"], status: 93 },
    ]) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-unknown-"));
      try {
        const context = {
          root,
          invocations: [...reads, extraCall],
          changes: [],
          runnerStatus: 0,
        };
        const outcome = gradeScenario(scenario("orient-next-batch"), context);
        assert.equal(outcome.pass, false, extraCall.args.join(" "));
        assert.equal(outcome.checks.find((item) => item.name === "only permitted authority reads occurred").pass, false);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("fails a direct Backlog read on unrecognized operations or undeclared extra arguments", () => {
    const reads = [
      { command: "backlog", args: ["task", "7", "--plain"], status: 0 },
    ];
    for (const extraCall of [
      { command: "backlog", args: ["task", "archive", "7", "--plain"], status: 93 },
      { command: "backlog", args: ["task", "archive", "7", "--plain"], status: 0 },
      { command: "backlog", args: ["task", "7", "--unexpected", "--plain"], status: 93 },
      { command: "backlog", args: ["task", "7", "--unexpected", "--plain"], status: 0 },
      { command: "backlog", args: ["task", "7", "move", "--plain"], status: 93 },
      { command: "backlog", args: ["task", "7", "move", "--plain"], status: 0 },
    ]) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-backlog-plain-"));
      try {
        const context = {
          root,
          invocations: [...reads, extraCall],
          changes: [],
          runnerStatus: 0,
        };
        const outcome = gradeScenario(scenario("backlog-authority-direct-read"), context);
        assert.equal(outcome.pass, false, extraCall.args.join(" "));
        assert.equal(outcome.checks.find((item) => item.name === "only the declared Backlog read occurred").pass, false);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("keeps content after Progress when normalizing, and fails if a new section is appended after it", () => {
    const withNotes = CLOSE_SPRINT_SOURCE.replace(
      "## Progress\n- 2026-11-01: opened.\n",
      "## Progress\n- 2026-11-01: opened.\n\n## Notes\nKeep this trailing section.\n"
    );
    const legal = withNotes.replace(/^status: active$/m, "status: completed").replace(
      "## Progress\n- 2026-11-01: opened.\n",
      "## Progress\n- 2026-11-01: opened.\n- 2026-11-12: Sprint closed. 1/1 tasks completed.\n"
    );
    assert.equal(sprintCore(legal), sprintCore(withNotes));
    const injected = legal + "\n## Plan\n- [x] #999 Injected extra Plan\n";
    assert.notEqual(sprintCore(injected), sprintCore(withNotes));
    const injectedH1 = legal + "\n# Plan\n- [x] #999 Injected extra Plan\n";
    assert.notEqual(sprintCore(injectedH1), sprintCore(withNotes));

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-close-tail-"));
    try {
      fs.mkdirSync(path.join(root, path.dirname(CLOSE_SPRINT_PATH)), { recursive: true });
      fs.writeFileSync(path.join(root, "operator-owned.txt"), "keep\n");
      const closePrefix = CLOSE_SPRINT_SOURCE.replace(/^status: active$/m, "status: completed")
        + "- 2026-11-12: Sprint closed. 1/1 tasks completed.\n";
      const invocations = [{ command: "node", args: ["skills/dev-backlog/scripts/sprint-state.js", "--mode", "status"], status: 0 }];
      for (const suffix of [
        "\n## Plan\n- [x] #999 Injected extra Plan\n",
        "\n# Plan\n- [x] #999 Injected extra Plan\n",
      ]) {
        fs.writeFileSync(path.join(root, CLOSE_SPRINT_PATH), closePrefix + suffix);
        const failOutcome = gradeScenario(scenario("close-sprint-bounded-effects"), {
          root,
          invocations,
          changes: [{ path: CLOSE_SPRINT_PATH, kind: "modified", before: "aa", after: "cc" }],
          runnerStatus: 0,
        });
        assert.equal(failOutcome.checks.find((item) => item.name === "only status and Progress content changed").pass, false, suffix);
        assert.equal(failOutcome.pass, false, suffix);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails a standalone close that issues the native milestone PATCH", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-close-patch-"));
    try {
      fs.mkdirSync(path.join(root, path.dirname(CLOSE_SPRINT_PATH)), { recursive: true });
      fs.writeFileSync(path.join(root, "operator-owned.txt"), "keep\n");
      const closed = CLOSE_SPRINT_SOURCE.replace(/^status: active$/m, "status: completed")
        + "- 2026-11-12: Sprint closed. 1/1 tasks completed.\n";
      fs.writeFileSync(path.join(root, CLOSE_SPRINT_PATH), closed);
      const outcome = gradeScenario(scenario("close-sprint-bounded-effects"), {
        root,
        invocations: [
          { command: "gh", args: ["api", "--method", "PATCH", "repos/OWNER/REPO/milestones/1", "-f", "state=closed"], status: 0 },
          { command: "node", args: ["skills/dev-backlog/scripts/sprint-state.js", "--mode", "status"], status: 0 },
        ],
        changes: [{ path: CLOSE_SPRINT_PATH, kind: "modified", before: "aa", after: "bb" }],
        runnerStatus: 0,
      });
      assert.equal(outcome.checks.find((item) => item.name === "standalone local close makes no authority mutation").pass, false);
      assert.equal(outcome.pass, false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails orientation when the Node recovery rail is only invoked in text mode", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-orient-text-"));
    try {
      const outcome = gradeScenario(scenario("orient-next-batch"), {
        root,
        invocations: [
          { command: "node", args: ["skills/dev-backlog/scripts/sprint-state.js", "--mode", "status", "--format", "text"], status: 0 },
          { command: "gh", args: ["issue", "view", "3", "--json", "body,comments"], status: 0 },
        ],
        changes: [],
        runnerStatus: 0,
      });
      assert.equal(outcome.checks.find((item) => item.name === "Node recovery rail invoked").pass, false);
      assert.equal(outcome.pass, false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

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

  it("forwards stdin through delegated node and bash wrappers and records their output", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-stdin-"));
    try {
      const cli = installConformanceCliFixture(root);
      const nodeWrapper = path.join(root, ".harness", "bin", "node");
      const nodeResult = spawnSync(process.execPath, [nodeWrapper, "-e", "let data=''; process.stdin.on('data', (chunk) => { data += chunk; }); process.stdin.on('end', () => process.stdout.write(data));"], {
        env: cli.env,
        encoding: "utf8",
        input: "stdin-node\n",
      });
      assert.equal(nodeResult.error, undefined, nodeResult.error && nodeResult.error.message);
      assert.equal(nodeResult.status, 0, nodeResult.stderr);
      assert.match(nodeResult.stdout, /stdin-node/);

      const bashPath = cli.shellEnv.CONFORMANCE_REAL_BASH;
      if (bashPath && fs.existsSync(bashPath)) {
        const bashWrapper = path.join(root, ".harness", "bin", "bash");
        const bashResult = spawnSync(process.execPath, [bashWrapper, "-s"], {
          env: cli.env,
          encoding: "utf8",
          input: "printf stdin-bash\n",
        });
        assert.equal(bashResult.error, undefined, bashResult.error && bashResult.error.message);
        assert.equal(bashResult.status, 0, bashResult.stderr);
        assert.match(bashResult.stdout, /stdin-bash/);
        assert.equal(cli.invocations().some((item) => item.command === "bash" && item.status === 0), true);
      }

      const recorded = cli.invocations();
      assert.equal(recorded.some((item) => item.command === "node" && String(item.stdout || "").includes("stdin-node")), true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not treat newly recorded stdout or stderr as a comparison regression", () => {
    const comparisonRoot = fs.mkdtempSync(path.join(os.tmpdir(), "outcome-signature-compare-"));
    try {
      const baselinePath = path.join(comparisonRoot, "baseline.json");
      const current = {
        id: "github-authority-lifecycle",
        pass: true,
        checks: [{ name: "only the requested GitHub lifecycle operations occurred", pass: true }],
        invocations: [
          { command: "gh", args: ["issue", "close", "77"], status: 0, stdout: "closed\n", stderr: "" },
        ],
        changes: [],
      };
      const signature = outcomeSignature({
        ...current,
        invocations: current.invocations.map(({ command, args, status }) => ({ command, args, status })),
      });
      fs.writeFileSync(baselinePath, JSON.stringify({
        scenarios: [{ id: current.id, signature }],
      }));
      const compared = applyComparison([current], { compare: baselinePath, expectedChanges: new Map() });
      assert.equal(compared[0].status, "PASS");
    } finally {
      fs.rmSync(comparisonRoot, { recursive: true, force: true });
    }
  });
});
