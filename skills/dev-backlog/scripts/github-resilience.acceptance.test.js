const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { writeGhFixture } = require("./fake-gh-fixture.js");

const SCRIPTS_DIR = __dirname;
const TRACKER_PATH = path.join(SCRIPTS_DIR, "tracker.js");
const LIB_PATH = path.join(SCRIPTS_DIR, "lib.js");

const FAIL_MODES = {
  "rate-limit": /API rate limit exceeded/,
  "auth-expired": /HTTP 401[\s\S]*authentication required/,
};

function makeRoot(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeWorker(root) {
  const worker = path.join(root, "tracker-worker.cjs");
  fs.writeFileSync(worker, `
const tracker = require(${JSON.stringify(TRACKER_PATH)});
const [backlogDir, action, payload = "{}"] = process.argv.slice(2);
const resolved = tracker.resolveConfiguredTracker(
  require(${JSON.stringify(LIB_PATH)}).readConfig(backlogDir),
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

function prepare(t) {
  const root = makeRoot(t, "github-resilience-");
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(path.join(backlogDir, "sprints"), { recursive: true });
  fs.writeFileSync(path.join(backlogDir, ".tracker"), "github\n");
  const gh = writeGhFixture(root);
  return {
    root,
    backlogDir,
    worker: writeWorker(root),
    env: gh.env,
    providerCalls: gh.calls,
    providerState: gh.state,
  };
}

function runWorker(fixture, action, payload = {}) {
  return spawnSync(
    process.execPath,
    [fixture.worker, fixture.backlogDir, action, JSON.stringify(payload)],
    { cwd: fixture.root, env: fixture.env, encoding: "utf8" },
  );
}

function seedIssue(fixture) {
  const created = runWorker(fixture, "create", { title: "Cycle task", body: "body" });
  assert.equal(created.status, 0, created.stderr);
  return created;
}

describe("GitHub resilience acceptance", () => {
  for (const [mode, stderrPattern] of Object.entries(FAIL_MODES)) {
    it(`${mode}: create fails loud once and writes no issue`, (t) => {
      const fixture = prepare(t);
      fixture.env.FAKE_GH_FAIL = mode;
      const result = runWorker(fixture, "create", { title: "Cycle task", body: "body" });
      assert.notEqual(result.status, 0);
      assert.match(`${result.stderr}\n${result.stdout}`, stderrPattern);
      assert.deepEqual(fixture.providerState().issues, []);
      assert.equal(fixture.providerCalls().length, 1);
    });

    it(`${mode}: update and close fail loud once and leave seeded issue unchanged`, (t) => {
      const fixture = prepare(t);
      seedIssue(fixture);
      const before = fixture.providerState();
      fixture.env.FAKE_GH_FAIL = mode;

      const updated = runWorker(fixture, "update", {
        selector: "#42",
        changes: { title: "Cycle task renamed" },
      });
      assert.notEqual(updated.status, 0);
      assert.match(`${updated.stderr}\n${updated.stdout}`, stderrPattern);

      const closed = runWorker(fixture, "close", { selector: "#42" });
      assert.notEqual(closed.status, 0);
      assert.match(`${closed.stderr}\n${closed.stdout}`, stderrPattern);

      assert.deepEqual(fixture.providerState().issues, before.issues);
      const mutating = fixture.providerCalls().slice(1);
      assert.equal(mutating.length, 2);
      assert.deepEqual(mutating[0].slice(0, 2), ["issue", "edit"]);
      assert.deepEqual(mutating[1].slice(0, 2), ["issue", "close"]);
    });
  }

  it("partial-outage: reads succeed, mutations fail once without writing", (t) => {
    const fixture = prepare(t);
    seedIssue(fixture);
    fixture.env.FAKE_GH_FAIL = "partial-outage";

    const listed = runWorker(fixture, "list", {
      state: "open",
      limit: 1,
      fields: "number,title,body,labels,milestone,assignees",
    });
    assert.equal(listed.status, 0, listed.stderr);
    assert.equal(JSON.parse(listed.stdout)[0].ref, "#42");

    const viewed = runWorker(fixture, "read", { selector: "#42" });
    assert.equal(viewed.status, 0, viewed.stderr);
    assert.equal(JSON.parse(viewed.stdout).title, "Cycle task");

    const before = fixture.providerState();
    const created = runWorker(fixture, "create", { title: "Another", body: "nope" });
    assert.notEqual(created.status, 0);
    assert.match(`${created.stderr}\n${created.stdout}`, /GitHub unavailable/);
    assert.deepEqual(fixture.providerState().issues, before.issues);

    const mutationCalls = fixture.providerCalls().filter((args) => args[1] === "create");
    assert.equal(mutationCalls.length, 2);
    assert.equal(
      fixture.providerCalls().filter((args) => args[1] === "create").length,
      2,
      "seed create + one failed create, no retry",
    );
  });
});
