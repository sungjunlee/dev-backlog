/**
 * GitHub resilience acceptance (#366): fail-loud contract.
 *
 * No silent retry, no fallback authority. When gh fails (rate limit, expired
 * auth, partial outage) every surviving GitHub mutation must:
 *   - exit non-zero with the provider's stderr surfaced,
 *   - leave GitHub state untouched (fake gh never saves state on failure),
 *   - make exactly one failing gh call (no automatic retry).
 *
 * Since #498 `triage-apply --apply` is the only scripted GitHub writer;
 * `sprint-init.js` and the sprint-state reader never touch the provider.
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
const { writeGhFixture } = require(path.join(TEST_FAKES, "fake-gh-fixture.js"));

const SCRIPTS_DIR = SKILL_SCRIPTS;
const SPRINT_INIT_PATH = path.join(SCRIPTS_DIR, "sprint-init.js");

function makeRoot(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(command, args, { cwd, env = process.env } = {}) {
  return spawnSync(command, args, { cwd, env, encoding: "utf8" });
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
