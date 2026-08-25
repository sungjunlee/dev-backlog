/**
 * GitHub resilience acceptance (#366): fail-loud contract.
 *
 * No silent retry, no fallback authority. When gh fails (rate limit, expired
 * auth, partial outage) every tracker mutation must:
 *   - exit non-zero with the provider's stderr surfaced,
 *   - leave GitHub state untouched (fake gh never saves state on failure),
 *   - make exactly one failing gh call (no automatic retry).
 *
 * Read-only paths under partial outage keep working. Sprint init must not
 * write a sprint file when gh fails, and sprint close --close-milestone must
 * refuse to mark the local sprint completed while the GitHub milestone stays
 * open.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const TRIAGE_SCRIPTS = path.resolve(__dirname, "../../skills/backlog-triage/scripts");
const { resolveBashExecutable, toBashArgs } = require(path.join(SKILL_SCRIPTS, "bash-runtime.js"));
const { writeGhFixture } = require(path.join(SKILL_SCRIPTS, "fake-gh-fixture.js"));
const { isIsolatedGithubError } = require(path.join(SKILL_SCRIPTS, "github-milestones.js"));

const SCRIPTS_DIR = SKILL_SCRIPTS;
const TRACKER_PATH = path.join(SCRIPTS_DIR, "tracker.js");
const SPRINT_INIT_PATH = path.join(SCRIPTS_DIR, "sprint-init.js");
const SPRINT_CLOSE_PATH = path.join(SCRIPTS_DIR, "sprint-close.sh");
const CREATE_ARGV = ["issue", "create", "--title", "Cycle task", "--body", "Body"];
const EDIT_ARGV = ["issue", "edit", "42", "--title", "Cycle task renamed"];
const CLOSE_ARGV = ["issue", "close", "42"];
const PATCH_ARGV = ["api", "-X", "PATCH", "repos/{owner}/{repo}/milestones/7", "-f", "state=closed"];

function makeRoot(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(command, args, { cwd, env = process.env } = {}) {
  const executable = command === "bash" ? resolveBashExecutable({ env }) : command;
  const commandArgs = command === "bash" ? toBashArgs(args) : args;
  return spawnSync(executable, commandArgs, { cwd, env, encoding: "utf8" });
}

function writeWorker(root) {
  const worker = path.join(root, "tracker-worker.cjs");
  fs.writeFileSync(worker, `
const tracker = require(${JSON.stringify(TRACKER_PATH)});
const [backlogDir, action, payload = "{}"] = process.argv.slice(2);
const resolved = tracker.resolveConfiguredTracker(
  require(${JSON.stringify(path.join(SCRIPTS_DIR, "lib.js"))}).readConfig(backlogDir),
  { backlogDir }
);
const input = JSON.parse(payload);
let result;
if (action === "list") result = resolved.adapter.list(input);
else if (action === "read") result = resolved.adapter.read(input.selector);
else if (action === "create") result = resolved.adapter.create(input);
else if (action === "update") result = resolved.adapter.update(input.selector, input.changes);
else if (action === "close") result = resolved.adapter.close(input.selector, input.options);
else throw new Error("unknown worker action: " + action);
process.stdout.write(JSON.stringify(result));
`);
  return worker;
}

const SEEDED_ISSUE = {
  number: 42, title: "Cycle task", body: "Body", state: "open",
  url: "https://github.test/acme/widgets/issues/42",
  labels: [{ name: "priority:high" }], milestone: { title: "Cycle Milestone" }, assignees: [],
};

function prepareFixture(t, { failMode, seedIssue = false } = {}) {
  const root = makeRoot(t, `gh-resilience-${failMode || "ok"}-`);
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(path.join(backlogDir, "sprints"), { recursive: true });
  fs.writeFileSync(path.join(backlogDir, ".tracker"), "github\n");
  const gh = writeGhFixture(root);
  if (seedIssue) {
    fs.writeFileSync(path.join(root, "gh-state.json"), JSON.stringify({
      nextIssue: 43, issues: [SEEDED_ISSUE], milestoneClosed: false,
    }));
  }
  const env = { ...gh.env };
  if (failMode) env.FAKE_GH_FAIL = failMode;
  return {
    root, cwd: root, backlogDir, worker: writeWorker(root),
    env, calls: gh.calls, state: gh.state,
    sprintFile: (name, lines) => {
      const sprintPath = path.join(backlogDir, "sprints", name);
      fs.writeFileSync(sprintPath, lines.join("\n") + "\n");
      return sprintPath;
    },
  };
}

// The operation must exit non-zero with the provider stderr surfaced, log
// exactly one gh call, and leave GitHub state byte-identical.
function assertFailsLoud(fixture, runOp, expectedArgv, expectedStderr) {
  const stateBefore = JSON.stringify(fixture.state());
  const callsBefore = fixture.calls().length;
  const result = runOp();
  assert.notEqual(result.status, 0, `expected failure, got stdout:\n${result.stdout}`);
  assert.match(result.stderr, expectedStderr);
  const calls = fixture.calls();
  assert.equal(calls.length - callsBefore, 1, "exactly one gh call, no silent retry");
  assert.deepEqual(calls[calls.length - 1], expectedArgv);
  assert.equal(JSON.stringify(fixture.state()), stateBefore, "GitHub state must be unchanged");
  return result;
}

describe("fail-loud GitHub resilience: rate-limit and auth-expired", () => {
  for (const [failMode, expectedStderr] of [
    ["rate-limit", /API rate limit exceeded/],
    ["auth-expired", /HTTP 401/, /authentication required/],
  ]) {
    it(`${failMode}: tracker create/update/close fail loud, one call, no state write`, (t) => {
      const fixture = prepareFixture(t, { failMode, seedIssue: true });
      const match = new RegExp(expectedStderr.source);

      assertFailsLoud(fixture,
        () => run(process.execPath, [fixture.worker, fixture.backlogDir, "create",
          JSON.stringify({ title: "Cycle task", body: "Body" })], fixture),
        CREATE_ARGV, match);
      assert.deepEqual(fixture.state().issues, [SEEDED_ISSUE]);

      assertFailsLoud(fixture,
        () => run(process.execPath, [fixture.worker, fixture.backlogDir, "update",
          JSON.stringify({ selector: "#42", changes: { title: "Cycle task renamed" } })], fixture),
        EDIT_ARGV, match);
      assert.equal(fixture.state().issues[0].title, "Cycle task");

      assertFailsLoud(fixture,
        () => run(process.execPath, [fixture.worker, fixture.backlogDir, "close",
          JSON.stringify({ selector: "#42" })], fixture),
        CLOSE_ARGV, match);
      assert.equal(fixture.state().issues[0].state, "open");
    });
  }
});

describe("isolated-environment classifier", () => {
  it("treats only git-isolation errors as isolated", () => {
    const isolated = [
      "gh: unable to expand placeholder in path",
      "gh: no git remotes found",
      "fatal: not a git repository (or any of the parent directories)",
    ];
    for (const stderr of isolated) {
      assert.equal(isIsolatedGithubError({ stderr }), true, stderr);
      assert.equal(isIsolatedGithubError(new Error(stderr)), true, stderr);
    }
    const providerFailures = [
      "gh: HTTP 502 Bad Gateway",
      "gh: secondary rate limit triggered",
      "gh: API rate limit exceeded",
      "gh: connection reset by peer",
    ];
    for (const stderr of providerFailures) {
      assert.equal(isIsolatedGithubError({ stderr }), false, stderr);
      assert.equal(isIsolatedGithubError(new Error(stderr)), false, stderr);
    }
  });

  it("http-502: sprint-init fails loud with no sprint file", (t) => {
    const fixture = prepareFixture(t, { failMode: "http-502" });
    const result = run(process.execPath, [
      SPRINT_INIT_PATH, "cycle", "--milestone", "Cycle Milestone", "--json",
    ], fixture);
    assert.notEqual(result.status, 0, `sprint init must fail loud:\n${result.stdout}`);
    assert.match(`${result.stdout}${result.stderr}`, /HTTP 502/);
    const sprintFiles = fs.existsSync(path.join(fixture.backlogDir, "sprints"))
      ? fs.readdirSync(path.join(fixture.backlogDir, "sprints")).filter((f) => f.endsWith(".md"))
      : [];
    assert.deepEqual(sprintFiles, [], "no sprint file on provider failure");
  });

  it("unknown milestone: --close-milestone fails loud and leaves the sprint active with no PATCH", (t) => {
    const fixture = prepareFixture(t, {});
    const sprintPath = fixture.sprintFile("2026-07-cycle.md", [
      "---", "milestone: DoesNotExist", "status: active", "started: 2026-07-31", "---", "",
      "# Resilience cycle", "", "## Plan", "", "## Running Context", "", "## Progress", "",
    ]);

    const result = run("bash", [SPRINT_CLOSE_PATH, fixture.backlogDir, "--close-milestone"], fixture);
    assert.notEqual(result.status, 0, `expected failure, got stdout:\n${result.stdout}`);
    assert.match(`${result.stdout}${result.stderr}`, /milestone not found: DoesNotExist/);
    assert.match(fs.readFileSync(sprintPath, "utf8"), /^status: active$/m,
      "local sprint must stay active when the milestone does not exist");
    const patchCalls = fixture.calls().filter((argv) =>
      JSON.stringify(argv) === JSON.stringify(PATCH_ARGV));
    assert.equal(patchCalls.length, 0, "no PATCH for a nonexistent milestone");
    assert.equal(fixture.state().milestoneClosed, false);
  });

  it("tracker-status-list.js CLI fails loud on rate-limit instead of printing a fallback row", (t) => {
    const fixture = prepareFixture(t, { failMode: "rate-limit" });
    const result = run(process.execPath, [
      path.join(SCRIPTS_DIR, "tracker-status-list.js"), fixture.backlogDir,
    ], fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /API rate limit exceeded/);
    assert.doesNotMatch(result.stdout, /gh not available/);
  });

  it("triage-apply --apply --yes makes exactly one gh call and leaves state unchanged under rate-limit", (t) => {
    const fixture = prepareFixture(t, { failMode: "rate-limit" });
    const report = path.join(fixture.root, "report.md");
    fs.writeFileSync(report, [
      "---", "generated: 2026-07-31", "---", "",
      "<!-- triage:close #42 reason=\"stale cleanup\" -->",
      "- [x] Close #42 - stale cleanup",
      "",
    ].join("\n"));
    const stateBefore = JSON.stringify(fixture.state());

    const result = run(process.execPath, [
      path.join(TRIAGE_SCRIPTS, "triage-apply.js"),
      report, "--apply", "--yes",
    ], fixture);
    assert.notEqual(result.status, 0, `expected failure, got stdout:\n${result.stdout}`);
    assert.match(result.stderr, /API rate limit exceeded/);
    const calls = fixture.calls();
    assert.equal(calls.length, 1, "exactly one gh call, no silent retry");
    assert.deepEqual(calls[0], ["issue", "comment", "42", "-b", "stale cleanup"]);
    assert.equal(JSON.stringify(fixture.state()), stateBefore, "GitHub state must be unchanged");
  });

  it("triage-collect --repo fails loud under rate-limit and creates no snapshot cache", (t) => {
    const fixture = prepareFixture(t, { failMode: "rate-limit" });
    fs.mkdirSync(path.join(fixture.backlogDir), { recursive: true });

    const result = run(process.execPath, [
      path.join(TRIAGE_SCRIPTS, "triage-collect.js"),
      "--repo", "acme/widgets",
    ], fixture);
    assert.notEqual(result.status, 0, `expected failure, got stdout:\n${result.stdout}`);
    assert.match(result.stderr, /API rate limit exceeded/);
    assert.equal(fs.existsSync(path.join(fixture.backlogDir, "triage", ".cache")), false,
      "no snapshot cache file created");
  });
});

describe("fail-loud GitHub resilience: partial-outage", () => {
  it("reads succeed while mutations fail exactly once with no state write", (t) => {
    const fixture = prepareFixture(t, { failMode: "partial-outage", seedIssue: true });

    const read = run(process.execPath, [fixture.worker, fixture.backlogDir, "read",
      JSON.stringify({ selector: "#42" })], fixture);
    assert.equal(read.status, 0, `read must succeed:\n${read.stderr}`);
    assert.equal(JSON.parse(read.stdout).title, "Cycle task");

    assertFailsLoud(fixture,
      () => run(process.execPath, [fixture.worker, fixture.backlogDir, "create",
        JSON.stringify({ title: "Cycle task", body: "Body" })], fixture),
      CREATE_ARGV, /GitHub unavailable/);

    assertFailsLoud(fixture,
      () => run(process.execPath, [fixture.worker, fixture.backlogDir, "update",
        JSON.stringify({ selector: "#42", changes: { title: "Cycle task renamed" } })], fixture),
      EDIT_ARGV, /GitHub unavailable/);
    assert.equal(fixture.state().issues[0].title, "Cycle task");

    // close-milestone legitimately makes two gh calls: a read-only lookup of
    // the milestone number (succeeds under partial outage) followed by one
    // failing PATCH. That is not a retry — require exactly two calls total,
    // exactly one of them the PATCH, with no extra PATCH retry.
    {
      const stateBefore = JSON.stringify(fixture.state());
      const callsBefore = fixture.calls().length;
      const result = run(process.execPath, [
        path.join(SCRIPTS_DIR, "tracker-capability.js"),
        "close-milestone", "milestones", fixture.backlogDir, "Cycle Milestone",
      ], fixture);
      assert.notEqual(result.status, 0, `expected failure, got stdout:\n${result.stdout}`);
      assert.match(result.stderr, /GitHub unavailable/);
      const calls = fixture.calls();
      assert.equal(calls.length - callsBefore, 2,
        "exactly two gh calls: milestone lookup + one failing PATCH");
      assert.deepEqual(calls[calls.length - 1], PATCH_ARGV,
        "last call must be the PATCH");
      const patchCalls = calls.slice(callsBefore).filter((argv) =>
        JSON.stringify(argv) === JSON.stringify(PATCH_ARGV));
      assert.equal(patchCalls.length, 1, "exactly one PATCH, no silent retry");
      assert.equal(JSON.stringify(fixture.state()), stateBefore,
        "GitHub state must be unchanged");
    }
    assert.equal(fixture.state().milestoneClosed, false);
  });
});

describe("fail-loud GitHub resilience: sprint init", () => {
  for (const failMode of ["rate-limit", "auth-expired"]) {
    it(`${failMode}: no sprint file is written and the command exits non-zero`, (t) => {
      const fixture = prepareFixture(t, { failMode });
      const result = run(process.execPath, [
        SPRINT_INIT_PATH, "cycle", "--milestone", "Cycle Milestone", "--json",
      ], fixture);
      assert.notEqual(result.status, 0, `sprint init must fail loud:\n${result.stdout}`);
      if (failMode === "rate-limit") {
        assert.match(`${result.stdout}${result.stderr}`, /API rate limit exceeded/);
      } else {
        assert.match(`${result.stdout}${result.stderr}`, /HTTP 401/);
        assert.match(`${result.stdout}${result.stderr}`, /authentication required/);
      }
      const sprintFiles = fs.existsSync(path.join(fixture.backlogDir, "sprints"))
        ? fs.readdirSync(path.join(fixture.backlogDir, "sprints")).filter((f) => f.endsWith(".md"))
        : [];
      assert.deepEqual(sprintFiles, [], "no sprint file on provider failure");
      assert.deepEqual(fixture.state().issues, []);
    });
  }
});

describe("fail-loud GitHub resilience: sprint close --close-milestone", () => {
  const ACTIVE_SPRINT = [
    "---", "milestone: Cycle Milestone", "status: active", "started: 2026-07-31", "---", "",
    "# Resilience cycle", "", "## Plan", "", "- [x] #42 Cycle task", "",
    "## Running Context", "", "## Progress", "",
  ];

  it("refuses to mark the sprint completed when the milestone PATCH fails", (t) => {
    const fixture = prepareFixture(t, { failMode: "partial-outage" });
    const sprintPath = fixture.sprintFile("2026-07-cycle.md", ACTIVE_SPRINT);

    const result = run("bash", [SPRINT_CLOSE_PATH, fixture.backlogDir, "--close-milestone"], fixture);
    assert.notEqual(result.status, 0, `sprint close must fail loud:\n${result.stdout}`);
    assert.match(`${result.stdout}${result.stderr}`, /GitHub unavailable|could not be closed/);
    assert.match(fs.readFileSync(sprintPath, "utf8"), /^status: active$/m,
      "local sprint must stay active while the GitHub milestone stays open");
    assert.equal(fixture.state().milestoneClosed, false);
    const patchCalls = fixture.calls().filter((argv) =>
      JSON.stringify(argv) === JSON.stringify(PATCH_ARGV));
    assert.equal(patchCalls.length, 1, "exactly one failing PATCH, no silent retry");
  });

  it("positive control: with gh healthy the close completes and closes the milestone", (t) => {
    const fixture = prepareFixture(t, {});
    const sprintPath = fixture.sprintFile("2026-07-cycle.md", ACTIVE_SPRINT);

    const result = run("bash", [SPRINT_CLOSE_PATH, fixture.backlogDir, "--close-milestone"], fixture);
    assert.equal(result.status, 0, `sprint close should succeed:\n${result.stdout}\n${result.stderr}`);
    assert.match(fs.readFileSync(sprintPath, "utf8"), /^status: completed$/m);
    assert.equal(fixture.state().milestoneClosed, true);
  });

  it("already-closed milestone succeeds with no PATCH", (t) => {
    const fixture = prepareFixture(t, {});
    fs.writeFileSync(path.join(fixture.root, "gh-state.json"), JSON.stringify({
      nextIssue: 43, issues: [], milestoneClosed: true,
    }));
    const sprintPath = fixture.sprintFile("2026-07-cycle.md", ACTIVE_SPRINT);

    const result = run("bash", [SPRINT_CLOSE_PATH, fixture.backlogDir, "--close-milestone"], fixture);
    assert.equal(result.status, 0, `already-closed should succeed:\n${result.stdout}\n${result.stderr}`);
    assert.match(fs.readFileSync(sprintPath, "utf8"), /^status: completed$/m);
    const patchCalls = fixture.calls().filter((argv) =>
      JSON.stringify(argv) === JSON.stringify(PATCH_ARGV));
    assert.equal(patchCalls.length, 0, "already closed must not PATCH");
  });
});
