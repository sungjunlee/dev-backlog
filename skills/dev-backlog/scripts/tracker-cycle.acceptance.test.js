const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveBashExecutable, toBashArgs } = require("./bash-runtime.js");
const { writeGhFixture } = require("./fake-gh-fixture.js");

const SCRIPTS_DIR = __dirname;
const TRACKER_PATH = path.join(SCRIPTS_DIR, "tracker.js");
const SYNC_PATH = path.join(SCRIPTS_DIR, "sync-pull.js");
const SPRINT_INIT_PATH = path.join(SCRIPTS_DIR, "sprint-init.js");
const SPRINT_CLOSE_PATH = path.join(SCRIPTS_DIR, "sprint-close.sh");
const STATUS_PATH = path.join(SCRIPTS_DIR, "status.sh");
const NEXT_PATH = path.join(SCRIPTS_DIR, "next.sh");
const EFFECTIVE_TASK_SPEC_PATH = path.join(SCRIPTS_DIR, "effective-task-spec.js");

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

function expectSuccess(result, context) {
  assert.equal(result.status, 0, `${context}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  assert.equal(result.signal, null, context);
  return result;
}

function parseJsonResult(result, context) {
  expectSuccess(result, context);
  return JSON.parse(result.stdout);
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

function runWorker(fixture, action, payload = {}) {
  return parseJsonResult(
    run(process.execPath, [fixture.worker, fixture.backlogDir, action, JSON.stringify(payload)], fixture),
    `${fixture.tracker} ${action}`
  );
}

function prepareGithub(t) {
  const root = makeRoot(t, "tracker-cycle-github-");
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(path.join(backlogDir, "sprints"), { recursive: true });
  fs.mkdirSync(path.join(backlogDir, "tasks"), { recursive: true });
  fs.mkdirSync(path.join(backlogDir, "completed"), { recursive: true });
  const legacyConfig = [
    'project_name: "legacy-cycle"',
    'task_prefix: "BACK"',
    'default_status: "To Do"',
    'statuses: ["To Do", "In Progress", "Done"]',
    "",
  ].join("\n");
  fs.writeFileSync(path.join(backlogDir, "config.yml"), legacyConfig);
  const gh = writeGhFixture(root);
  return {
    tracker: "github", root, cwd: root, backlogDir, legacyConfig, worker: writeWorker(root),
    env: gh.env, providerCalls: gh.calls, providerState: gh.state,
  };
}

function prepareMirrorlessGithub(t) {
  const root = makeRoot(t, "tracker-cycle-github-mirrorless-");
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(path.join(backlogDir, "sprints"), { recursive: true });
  fs.writeFileSync(path.join(backlogDir, ".tracker"), "github\n");
  const gh = writeGhFixture(root);
  return {
    tracker: "github", root, cwd: root, backlogDir, worker: writeWorker(root),
    env: gh.env, providerCalls: gh.calls, providerState: gh.state,
  };
}

function orient(fixture) {
  const status = parseJsonResult(
    run("bash", [STATUS_PATH, "--json", fixture.backlogDir], fixture),
    `${fixture.tracker} status --json`
  );
  const next = parseJsonResult(
    run("bash", [NEXT_PATH, "--json", fixture.backlogDir], fixture),
    `${fixture.tracker} next --json`
  );
  return { status, next };
}

function finishSprint(fixture, sprintPath, { closeMilestone = false } = {}) {
  const before = fs.readFileSync(sprintPath, "utf8");
  fs.writeFileSync(sprintPath, before.replace("- [ ] ", "- [x] "));
  const args = [SPRINT_CLOSE_PATH, fixture.backlogDir];
  if (closeMilestone) args.push("--close-milestone");
  expectSuccess(run("bash", args, fixture), `${fixture.tracker} sprint close`);
  assert.match(fs.readFileSync(sprintPath, "utf8"), /^status: completed$/m);
}

function runGithubCycle(fixture) {
  const configPath = path.join(fixture.backlogDir, "config.yml");
  const body = "Human GitHub body\n\n## Acceptance Criteria\n- [ ] Preserve me";
  const created = runWorker(fixture, "create", { title: "Cycle task", body });
  assert.deepEqual(created, {
    tracker: "github", id: "42", ref: "#42", url: "https://github.test/acme/widgets/issues/42",
  });

  const pulled = parseJsonResult(
    run(process.execPath, [SYNC_PATH, "--legacy-export", "--limit", "1", "--json"], fixture),
    "github sync-pull"
  );
  assert.equal(pulled.createdFiles[0], "BACK-42 - cycle-task.md");
  const taskPath = path.join(fixture.backlogDir, "tasks", pulled.createdFiles[0]);
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(fs.readFileSync(taskPath, "utf8"), [
    "---", "id: BACK-42", "title: Cycle task", "status: To Do", "labels: []",
    "priority: high", "milestone: Cycle Milestone", `created_date: '${today}'`, "---",
    "## Description", "Human GitHub body", "", "## Acceptance Criteria", "- [ ] Preserve me", "",
  ].join("\n"));

  const init = parseJsonResult(run(process.execPath, [
    SPRINT_INIT_PATH, "cycle", "--milestone", "Cycle Milestone", "--json",
  ], fixture), "github sprint-init");
  const sprintPath = path.join(fixture.root, init.sprintFile);
  assert.match(fs.readFileSync(sprintPath, "utf8"), /^due: 2026-06-30$/m);
  assert.match(fs.readFileSync(sprintPath, "utf8"), /^- \[ \] #42 Cycle task$/m);

  const { status, next } = orient(fixture);
  assert.deepEqual(status.plan_items.map(({ tracker, id, ref, issue_number }) => ({ tracker, id, ref, issue_number })), [
    { tracker: "github", id: "42", ref: "#42", issue_number: 42 },
  ]);
  assert.equal(next.next_batch.items[0].ref, "#42");
  assert.equal(runWorker(fixture, "read", { selector: "#42" }).title, "Cycle task");

  const originalBody = fs.readFileSync(taskPath, "utf8").slice(fs.readFileSync(taskPath, "utf8").indexOf("\n## Description"));
  runWorker(fixture, "update", { selector: "#42", changes: { title: "Cycle task renamed" } });
  parseJsonResult(run(process.execPath, [
    SYNC_PATH, "--legacy-export", "--limit", "1", "--update", "--json",
  ], fixture), "github update mirror");
  const updatedMirror = fs.readFileSync(taskPath, "utf8");
  assert.match(updatedMirror, /^title: Cycle task renamed$/m);
  assert.equal(updatedMirror.slice(updatedMirror.indexOf("\n## Description")), originalBody);

  finishSprint(fixture, sprintPath, { closeMilestone: true });
  const completedPath = path.join(fixture.backlogDir, "completed", path.basename(taskPath));
  assert.equal(fs.existsSync(taskPath), false);
  assert.equal(fs.readFileSync(completedPath, "utf8"), updatedMirror);
  runWorker(fixture, "close", { selector: "#42" });
  assert.equal(runWorker(fixture, "list", { state: "closed", limit: 20 })[0].ref, "#42");
  assert.equal(runWorker(fixture, "read", { selector: "#42" }).state, "closed");

  assert.equal(fs.readFileSync(configPath, "utf8"), fixture.legacyConfig, "legacy config must not migrate");
  assert.equal(
    fs.existsSync(path.join(fixture.backlogDir, ".tracker")),
    false,
    "runtime fallback must not migrate"
  );
  const calls = fixture.providerCalls();
  assert.deepEqual(calls, [
    ["issue", "create", "--title", "Cycle task", "--body", body],
    ["issue", "list", "--state", "open", "--limit", "1", "--json", "number,title,body,labels,milestone,assignees"],
    ["api", "repos/{owner}/{repo}/milestones", "--jq", '.[] | select(.title==env.MS) | .due_on'],
    ["issue", "list", "--milestone", "Cycle Milestone", "--state", "open", "--json", "number,title,labels"],
    ["issue", "view", "42", "--json", "number,title,body,labels,milestone,assignees,createdAt,updatedAt"],
    ["issue", "edit", "42", "--title", "Cycle task renamed"],
    ["issue", "list", "--state", "open", "--limit", "1", "--json", "number,title,body,labels,milestone,assignees"],
    ["api", "--paginate", "repos/{owner}/{repo}/milestones?state=all&per_page=100", "--jq", '.[] | select(.title==env.MS) | [.number, .state] | @tsv'],
    ["api", "-X", "PATCH", "repos/{owner}/{repo}/milestones/7", "-f", "state=closed"],
    ["issue", "close", "42"],
    ["issue", "list", "--state", "closed", "--limit", "20", "--json", "number,title,body,labels,milestone,assignees,createdAt,updatedAt"],
    ["issue", "view", "42", "--json", "number,title,body,labels,milestone,assignees,createdAt,updatedAt"],
  ]);
  assert.deepEqual(fixture.providerState(), {
    nextIssue: 43,
    issues: [{
      number: 42, title: "Cycle task renamed", body, state: "closed",
      url: "https://github.test/acme/widgets/issues/42",
      labels: [{ name: "priority:high" }], milestone: { title: "Cycle Milestone" }, assignees: [],
    }],
    milestoneClosed: true,
  });
}

function runMirrorlessGithubCycle(fixture) {
  const assertNoTaskDirectories = () => {
    assert.equal(fs.existsSync(path.join(fixture.backlogDir, "tasks")), false);
    assert.equal(fs.existsSync(path.join(fixture.backlogDir, "completed")), false);
  };
  const body = "Live Issue body\n\n## Acceptance Criteria\n- [ ] Preserve live AC";
  const created = runWorker(fixture, "create", { title: "Cycle task", body });
  assert.equal(created.ref, "#42");
  assertNoTaskDirectories();

  const sprintPath = path.join(fixture.backlogDir, "sprints", "2026-07-github-cycle.md");
  fs.writeFileSync(sprintPath, [
    "---", "status: active", "started: 2026-07-31", "---", "",
    "# GitHub mirrorless cycle", "", "## Goal", "Prove live task execution without mirrors.", "",
    "## Plan", "", "### Batch 1 - live", "- [ ] #42 Cycle task", "",
    "## Running Context", "Live GitHub is task authority.", "", "## Progress", "",
  ].join("\n"));

  const { status, next } = orient(fixture);
  assert.equal(status.plan_items[0].ref, "#42");
  assert.equal(next.next_batch.items[0].ref, "#42");
  assertNoTaskDirectories();

  const effective = parseJsonResult(run(process.execPath, [
    EFFECTIVE_TASK_SPEC_PATH, "#42", "--backlog-dir", fixture.backlogDir,
    "--root", fixture.root,
  ], fixture), "github effective task read");
  assert.equal(effective.source_ref, "https://github.test/acme/widgets/issues/42#issue-body");
  assert.equal(effective.lifecycle.state, "open");
  assert.equal(effective.acceptance_criteria.length, 1);
  assert.equal(effective.acceptance_criteria[0].text, "Preserve live AC");
  assertNoTaskDirectories();

  runWorker(fixture, "update", {
    selector: "#42",
    changes: { title: "Cycle task renamed" },
  });
  const updated = runWorker(fixture, "read", { selector: "#42" });
  assert.equal(updated.title, "Cycle task renamed");
  assertNoTaskDirectories();

  runWorker(fixture, "close", { selector: "#42" });
  finishSprint(fixture, sprintPath);
  assert.equal(runWorker(fixture, "read", { selector: "#42" }).state, "closed");
  assert.equal(runWorker(fixture, "list", { state: "closed", limit: 20 })[0].ref, "#42");

  assertNoTaskDirectories();
}

describe("GitHub tracker core cycle acceptance", () => {
  it("setup/config → create → Plan → orient/read → update → complete → final read/list", (t) => {
    runGithubCycle(prepareGithub(t));
  });
});

describe("mirrorless GitHub core acceptance", () => {
  it("runs create → Plan → orient/effective read → update → complete with no task directories", (t) => {
    runMirrorlessGithubCycle(prepareMirrorlessGithub(t));
  });

  it("does not require Relay, Matt/craftkit, Projects, or Backlog.md tooling", (t) => {
    const fixture = prepareMirrorlessGithub(t);
    const optionalPaths = [
      path.join(fixture.root, ".relay"),
      path.join(fixture.root, ".agents", "skills"),
      path.join(fixture.root, "spec"),
      path.join(fixture.root, "node_modules"),
      path.join(fixture.backlogDir, "tasks"),
      path.join(fixture.backlogDir, "completed"),
    ];
    for (const optionalPath of optionalPaths) {
      assert.equal(fs.existsSync(optionalPath), false, `${optionalPath} must start absent`);
    }

    runMirrorlessGithubCycle(fixture);

    for (const optionalPath of optionalPaths) {
      assert.equal(fs.existsSync(optionalPath), false, `${optionalPath} must remain absent`);
    }
    assert.equal(
      fixture.providerCalls().some((args) =>
        args[0] === "project" ||
        args.some((arg) => /projects(?:V2)?/i.test(String(arg)))
      ),
      false,
      "core execution must not require GitHub Projects"
    );
  });
});
