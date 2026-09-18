/**
 * GitHub resilience acceptance (#366): fail-loud contract.
 *
 * No silent retry, no fallback authority. When gh fails (rate limit, expired
 * auth, partial outage) every surviving GitHub mutation must:
 *   - exit non-zero with the provider's stderr surfaced,
 *   - leave GitHub state untouched (fake gh never saves state on failure),
 *   - make exactly one failing gh call (no automatic retry).
 *
 * Since #445 the only scripted GitHub calls left are `sprint-close.sh
 * --close-milestone` and `triage-apply --apply`; `sprint-init.js` no longer
 * touches the provider at all.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const TEST_FAKES = path.resolve(__dirname, "../fakes");
const TRIAGE_SCRIPTS = path.resolve(__dirname, "../../skills/backlog-triage/scripts");
const { resolveBashExecutable, toBashArgs } = require(path.resolve(__dirname, "../tools/bash-runtime.js"));
const { writeGhFixture } = require(path.join(TEST_FAKES, "fake-gh-fixture.js"));

const SCRIPTS_DIR = SKILL_SCRIPTS;
const SPRINT_INIT_PATH = path.join(SCRIPTS_DIR, "sprint-init.js");
const SPRINT_CLOSE_PATH = path.join(SCRIPTS_DIR, "sprint-close.sh");
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

function prepareFixture(t, { failMode } = {}) {
  const root = makeRoot(t, `gh-resilience-${failMode || "ok"}-`);
  const backlogDir = path.join(root, ".dev-backlog");
  fs.mkdirSync(path.join(backlogDir, "sprints"), { recursive: true });
  const gh = writeGhFixture(root);
  const env = { ...gh.env };
  if (failMode) env.FAKE_GH_FAIL = failMode;
  return {
    root, cwd: root, backlogDir,
    env, calls: gh.calls, state: gh.state,
    sprintFile: (name, lines) => {
      const sprintPath = path.join(backlogDir, "sprints", name);
      fs.writeFileSync(sprintPath, lines.join("\n") + "\n");
      return sprintPath;
    },
  };
}

describe("sprint-init makes no provider call at all (#445)", () => {
  for (const failMode of ["rate-limit", "http-502"]) {
    it(`${failMode}: the sprint file is still written and no gh call is made`, (t) => {
      const fixture = prepareFixture(t, { failMode });
      const result = run(process.execPath, [
        SPRINT_INIT_PATH, "cycle", "--milestone", "Cycle Milestone",
      ], fixture);
      assert.equal(result.status, 0, `sprint init must not need gh:\n${result.stderr}`);
      assert.match(result.stdout, /Created:/);
      assert.match(result.stdout, /due: TBD/);
      assert.deepEqual(fixture.calls(), []);
    });
  }
});

describe("triage-apply fails loud under provider failure", () => {
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
});

describe("fail-loud GitHub resilience: sprint close --close-milestone", () => {
  const ACTIVE_SPRINT = [
    "---", "milestone: Cycle Milestone", "status: active", "started: 2026-07-31", "---", "",
    "# Resilience cycle", "", "## Plan", "", "- [x] #42 Cycle task", "",
    "## Running Context", "", "## Progress", "",
  ];

  it("unknown milestone: fails loud and leaves the sprint active with no PATCH", (t) => {
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

  it("rate-limit: the milestone lookup itself fails loud with no local mutation", (t) => {
    const fixture = prepareFixture(t, { failMode: "rate-limit" });
    const sprintPath = fixture.sprintFile("2026-07-cycle.md", ACTIVE_SPRINT);

    const result = run("bash", [SPRINT_CLOSE_PATH, fixture.backlogDir, "--close-milestone"], fixture);
    assert.notEqual(result.status, 0, `sprint close must fail loud:\n${result.stdout}`);
    assert.match(`${result.stdout}${result.stderr}`, /API rate limit exceeded|could not be closed/);
    assert.match(fs.readFileSync(sprintPath, "utf8"), /^status: active$/m);
    assert.equal(fixture.calls().length, 1, "exactly one gh call, no silent retry");
    assert.equal(fixture.state().milestoneClosed, false);
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
