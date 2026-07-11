const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const trackerModule = require("./tracker.js");

const SCRIPTS_DIR = __dirname;
const TRACKER_PATH = path.join(SCRIPTS_DIR, "tracker.js");
const SETUP_PATH = path.join(SCRIPTS_DIR, "setup-dev-backlog.js");
const SYNC_PATH = path.join(SCRIPTS_DIR, "sync-pull.js");
const SPRINT_INIT_PATH = path.join(SCRIPTS_DIR, "sprint-init.js");
const SPRINT_CLOSE_PATH = path.join(SCRIPTS_DIR, "sprint-close.sh");
const SPRINT_MIRROR_PATH = path.join(SCRIPTS_DIR, "sprint-mirror.js");
const PROGRESS_SYNC_PATH = path.join(SCRIPTS_DIR, "progress-sync.js");
const STATUS_PATH = path.join(SCRIPTS_DIR, "status.sh");
const NEXT_PATH = path.join(SCRIPTS_DIR, "next.sh");

function makeRoot(t, prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function run(command, args, { cwd, env = process.env } = {}) {
  return spawnSync(command, args, { cwd, env, encoding: "utf8" });
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

function writeGhFixture(root) {
  const binDir = path.join(root, "bin");
  const statePath = path.join(root, "gh-state.json");
  const logPath = path.join(root, "gh-argv.jsonl");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify({
    nextIssue: 42,
    issues: [],
    mirror: null,
    progress: {},
    comments: [],
    milestoneClosed: false,
  }));
  const ghPath = path.join(binDir, "gh");
  fs.writeFileSync(ghPath, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const statePath = process.env.FAKE_GH_STATE;
const logPath = process.env.FAKE_GH_LOG;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
fs.appendFileSync(logPath, JSON.stringify(args) + "\\n");
const save = () => fs.writeFileSync(statePath, JSON.stringify(state));
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const out = (value) => process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
const exact = (expected) => JSON.stringify(args) === JSON.stringify(expected);
const exactBodyCall = (head) =>
  args.length === head.length + 2 &&
  exact([...head, "--body", args[args.length - 1]]) &&
  typeof args[args.length - 1] === "string";

if (exactBodyCall(["issue", "create", "--title", args[3]]) && args[3]) {
  const title = valueAfter("--title");
  const body = valueAfter("--body") || "";
  if (title.startsWith("Sprint mirror:")) {
    state.mirror = { number: 84, title, body };
    save(); out("https://github.test/acme/widgets/issues/84\\n");
  } else if (title.startsWith("Progress:")) {
    state.progress[title] = { number: 90, title, body, state: "open" };
    save(); out("https://github.test/acme/widgets/issues/90\\n");
  } else {
    const number = state.nextIssue++;
    state.issues.push({
      number, title, body, state: "open", url: "https://github.test/acme/widgets/issues/" + number,
      labels: [{ name: "priority:high" }], milestone: { title: "Cycle Milestone" }, assignees: [],
    });
    save(); out("https://github.test/acme/widgets/issues/" + number + "\\n");
  }
  process.exit(0);
}

if (args[0] === "issue" && args[1] === "list") {
  if (exact(["issue", "list", "--milestone", "Cycle Milestone", "--state", "open", "--json", "number,title,labels"])) {
    out(state.issues.filter((issue) => issue.state === "open").map(({ number, title, labels }) => ({ number, title, labels })));
  } else if (exact(["issue", "list", "--state", "all", "--search", "dev-backlog:sprint-mirror in:body", "--json", "number,body", "--limit", "50"])) {
    out(state.mirror ? [state.mirror] : []);
  } else if (/^Progress: (May|June|July) 2026$/.test(String(valueAfter("--search")).replace(/^\"|\" in:title$/g, "")) &&
      exact(["issue", "list", "--state", "all", "--search", valueAfter("--search"), "--json", "number,title,body", "--limit", "50"])) {
    const title = String(valueAfter("--search")).replace(/^\"|\" in:title$/g, "");
    out(state.progress[title] ? [state.progress[title]] : []);
  } else if (exact(["issue", "list", "--state", "open", "--limit", "1", "--json", "number,title,body,labels,milestone,assignees"]) ||
      exact(["issue", "list", "--state", "closed", "--limit", "20", "--json", "number,title,body,labels,milestone,assignees,createdAt,updatedAt"])) {
    out(state.issues.filter((issue) => {
      const requested = valueAfter("--state") || "open";
      return requested === "all" || issue.state === requested;
    }));
  } else {
    process.stderr.write("unhandled fake gh argv: " + JSON.stringify(args) + "\\n"); process.exit(93);
  }
  process.exit(0);
}

if (exact(["issue", "view", "42", "--json", "number,title,body,labels,milestone,assignees,createdAt,updatedAt"])) {
  const issue = state.issues.find((candidate) => String(candidate.number) === args[2]);
  if (!issue) process.exit(4);
  out(issue); process.exit(0);
}

if (exact(["issue", "edit", "42", "--title", "Cycle task renamed"]) ||
    exactBodyCall(["issue", "edit", "84"]) || exactBodyCall(["issue", "edit", "90"])) {
  const number = Number(args[2]);
  if (number === 84 && state.mirror) state.mirror.body = valueAfter("--body");
  else if (number === 90) {
    const entry = Object.values(state.progress).find((candidate) => candidate.number === number);
    if (entry) entry.body = valueAfter("--body");
  } else {
    const issue = state.issues.find((candidate) => candidate.number === number);
    if (issue && args.includes("--title")) issue.title = valueAfter("--title");
    if (issue && args.includes("--body")) issue.body = valueAfter("--body");
  }
  save(); process.exit(0);
}

if (exact(["issue", "close", "42"])) {
  const issue = state.issues.find((candidate) => String(candidate.number) === args[2]);
  if (issue) issue.state = "closed";
  save(); process.exit(0);
}

if (exact(["pr", "list", "--state", "open", "--json", "number,title", "--limit", "100"])) {
  out([{ number: 98, title: "Open cycle PR" }]); process.exit(0);
}
if (exact(["pr", "list", "--state", "merged", "--search", "merged:>=2026-06-01 merged:<2026-07-01", "--json", "number,title,url,mergedAt,closingIssuesReferences", "--limit", "200"])) {
  out([{ number: 99, title: "Merged cycle PR", url: "https://github.test/acme/widgets/pull/99",
    mergedAt: "2026-06-15T00:00:00Z", closingIssuesReferences: [{ number: 42 }] }]);
  process.exit(0);
}

if (exact(["api", "repos/{owner}/{repo}/milestones", "--jq", '.[] | select(.title==env.MS) | .due_on']) ||
    exact(["api", "repos/{owner}/{repo}/milestones", "--jq", '.[] | select(.title==env.MS) | .number'])) {
  const query = valueAfter("--jq");
  out(query.includes("due_on") ? "2026-06-30T00:00:00Z\\n" : "7\\n");
  process.exit(0);
}
if (exact(["api", "-X", "PATCH", "repos/{owner}/{repo}/milestones/7", "-f", "state=closed"])) {
  state.milestoneClosed = true; save(); process.exit(0);
}
if (exact(["api", "repos/{owner}/{repo}/issues/90/comments", "--paginate"])) {
  out(state.comments); process.exit(0);
}
if (args.length === 6 && exact(["api", "repos/{owner}/{repo}/issues/90/comments", "--method", "POST", "--field", args[5]]) &&
    String(args[5]).startsWith("body=")) {
  state.comments.push({ id: 501, body: valueAfter("--field").slice("body=".length) });
  save(); process.exit(0);
}
if (exact(["api", "repos/{owner}/{repo}/issues/90", "--method", "PATCH", "--field", "state=closed"])) {
  const entry = Object.values(state.progress).find((candidate) => candidate.number === 90);
  if (entry) entry.state = "closed";
  save(); process.exit(0);
}

process.stderr.write("unhandled fake gh argv: " + JSON.stringify(args) + "\\n");
process.exit(93);
`);
  fs.chmodSync(ghPath, 0o755);
  return {
    env: {
      ...process.env,
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
      FAKE_GH_STATE: statePath,
      FAKE_GH_LOG: logPath,
    },
    calls: () => fs.existsSync(logPath)
      ? fs.readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      : [],
    state: () => JSON.parse(fs.readFileSync(statePath, "utf8")),
  };
}

function writeGhTrap(root) {
  const binDir = path.join(root, "bin");
  const marker = path.join(root, "gh-was-called");
  fs.mkdirSync(binDir, { recursive: true });
  const ghPath = path.join(binDir, "gh");
  fs.writeFileSync(ghPath, `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(marker)}\nexit 97\n`);
  fs.chmodSync(ghPath, 0o755);
  return {
    env: { ...process.env, PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}` },
    calls: () => fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim().split("\n") : [],
  };
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

function prepareLocal(t) {
  const root = makeRoot(t, "tracker-cycle-local-");
  const trap = writeGhTrap(root);
  const setup = parseJsonResult(run(process.execPath, [
    SETUP_PATH, "--tracker", "local", "--non-interactive", "--json", "--project-name", "offline-cycle",
  ], { cwd: root, env: trap.env }), "local setup");
  assert.equal(setup.selection, "local");
  return {
    tracker: "local", root, cwd: root, backlogDir: path.join(root, "backlog"),
    worker: writeWorker(root), env: trap.env, providerCalls: trap.calls,
  };
}

const CYCLE_ROWS = [
  { tracker: "github", prepare: prepareGithub },
  { tracker: "local", prepare: prepareLocal },
];

function writeLocalSprint(fixture, identity) {
  const sprintPath = path.join(fixture.backlogDir, "sprints", "2026-07-local-cycle.md");
  fs.writeFileSync(sprintPath, [
    "---", "milestone: local cycle", "status: active", "started: 2026-07-12", "---", "",
    "# Local cycle", "", "## Goal", "Prove the local core cycle.", "", "## Plan", "",
    "### Batch 1 - local", `- [ ] ${identity.ref} Offline canonical task`, "",
    "## Running Context", "Local files are canonical.", "", "## Progress", "",
  ].join("\n"));
  return sprintPath;
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
    run(process.execPath, [SYNC_PATH, "--limit", "1", "--json"], fixture),
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
  const sprintSlug = path.basename(init.sprintFile, ".md");
  assert.match(fs.readFileSync(sprintPath, "utf8"), /^due: 2026-06-30$/m);
  assert.match(fs.readFileSync(sprintPath, "utf8"), /^- \[ \] #42 Cycle task$/m);

  const { status, next } = orient(fixture);
  assert.deepEqual(status.plan_items.map(({ tracker, id, ref, issue_number }) => ({ tracker, id, ref, issue_number })), [
    { tracker: "github", id: "42", ref: "#42", issue_number: 42 },
  ]);
  assert.equal(next.next_batch.items[0].ref, "#42");
  assert.equal(runWorker(fixture, "read", { selector: "#42" }).title, "Cycle task");

  const mirrorCreate = parseJsonResult(
    run(process.execPath, [SPRINT_MIRROR_PATH, fixture.backlogDir, "--json"], fixture),
    "github sprint mirror create"
  );
  const mirrorUpdate = parseJsonResult(
    run(process.execPath, [SPRINT_MIRROR_PATH, fixture.backlogDir, "--json"], fixture),
    "github sprint mirror update"
  );
  assert.deepEqual([mirrorCreate.action, mirrorUpdate.action], ["created", "updated"]);
  assert.deepEqual([mirrorCreate.issue_number, mirrorUpdate.issue_number], [84, 84]);

  const progress = parseJsonResult(run(process.execPath, [
    PROGRESS_SYNC_PATH, "--month", "2026-06", "--finalize", "--json",
  ], fixture), "github progress finalize");
  assert.equal(progress.issueNumber, 90);
  assert.equal(progress.summary.merged, 1);
  assert.equal(progress.summary.inFlight, 1);
  assert.equal(progress.comments.created, 1);
  assert.equal(progress.closed, true);
  assert.equal(progress.body, [
    "<!-- dev-backlog:progress-issue month=2026-06 -->", "",
    "# Progress: June 2026", "", "## Summary", "",
    "| Metric | Count |", "| --- | --- |", "| Merged PRs (month) | 1 |",
    "| In-flight (open PRs) | 1 |", "| Stuck candidates | 0 |", "",
    "## Month End", "", `- Finalized on: ${progress.finalizedAt}`,
    "- State: closed", "", "## Active Sprint", "",
    `**${sprintSlug}.md** — 0/1 done, 0 in-flight, 1 remaining`, "",
  ].join("\n"));

  const originalBody = fs.readFileSync(taskPath, "utf8").slice(fs.readFileSync(taskPath, "utf8").indexOf("\n## Description"));
  runWorker(fixture, "update", { selector: "#42", changes: { title: "Cycle task renamed" } });
  parseJsonResult(run(process.execPath, [SYNC_PATH, "--limit", "1", "--update", "--json"], fixture), "github update mirror");
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
  const mergeComment = [
    "<!-- dev-backlog:progress-comment id=2026-06/merge/pr-99 -->",
    "**Merged:** [#99](https://github.test/acme/widgets/pull/99) — Merged cycle PR",
    "- Task: #42",
    "- Landed: 2026-06-15 00:00 UTC",
  ].join("\n");
  const calls = fixture.providerCalls();
  const mirrorCreateBody = calls[6]?.[5];
  const mirrorUpdateBody = calls[8]?.[4];
  const mirrorBodyPrefix = [
    `<!-- dev-backlog:sprint-mirror sprint=${sprintSlug} -->`, "",
    "> The local sprint file is canonical. This mirror is read-only — it is",
    "> not edited by hand — and sync is always explicit; there is no daemon.", "",
    "## Goal", "", "[One sentence: what's true when this sprint is done]", "",
    "## Plan", "", "- [ ] #42 Cycle task", "", "## Latest Progress", "",
    "_No progress recorded yet._", "", "Last explicit sync: ",
  ].join("\n");
  const mirrorBodyPattern = new RegExp(
    `^${escapeRegExp(mirrorBodyPrefix)}\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$`
  );
  assert.match(mirrorCreateBody, mirrorBodyPattern);
  assert.match(mirrorUpdateBody, mirrorBodyPattern);
  assert.deepEqual(calls, [
    ["issue", "create", "--title", "Cycle task", "--body", body],
    ["issue", "list", "--state", "open", "--limit", "1", "--json", "number,title,body,labels,milestone,assignees"],
    ["api", "repos/{owner}/{repo}/milestones", "--jq", '.[] | select(.title==env.MS) | .due_on'],
    ["issue", "list", "--milestone", "Cycle Milestone", "--state", "open", "--json", "number,title,labels"],
    ["issue", "view", "42", "--json", "number,title,body,labels,milestone,assignees,createdAt,updatedAt"],
    ["issue", "list", "--state", "all", "--search", "dev-backlog:sprint-mirror in:body", "--json", "number,body", "--limit", "50"],
    ["issue", "create", "--title", `Sprint mirror: ${mirrorCreate.sprint}`, "--body", mirrorCreateBody],
    ["issue", "list", "--state", "all", "--search", "dev-backlog:sprint-mirror in:body", "--json", "number,body", "--limit", "50"],
    ["issue", "edit", "84", "--body", mirrorUpdateBody],
    ["pr", "list", "--state", "open", "--json", "number,title", "--limit", "100"],
    ["pr", "list", "--state", "merged", "--search", "merged:>=2026-06-01 merged:<2026-07-01", "--json", "number,title,url,mergedAt,closingIssuesReferences", "--limit", "200"],
    ["issue", "list", "--state", "all", "--search", '"Progress: June 2026" in:title', "--json", "number,title,body", "--limit", "50"],
    ["issue", "list", "--state", "all", "--search", '"Progress: May 2026" in:title', "--json", "number,title,body", "--limit", "50"],
    ["issue", "list", "--state", "all", "--search", '"Progress: July 2026" in:title', "--json", "number,title,body", "--limit", "50"],
    ["issue", "create", "--title", "Progress: June 2026", "--body", progress.body],
    ["api", "repos/{owner}/{repo}/issues/90/comments", "--paginate"],
    ["api", "repos/{owner}/{repo}/issues/90/comments", "--method", "POST", "--field", `body=${mergeComment}`],
    ["api", "repos/{owner}/{repo}/issues/90", "--method", "PATCH", "--field", "state=closed"],
    ["issue", "edit", "42", "--title", "Cycle task renamed"],
    ["issue", "list", "--state", "open", "--limit", "1", "--json", "number,title,body,labels,milestone,assignees"],
    ["api", "repos/{owner}/{repo}/milestones", "--jq", '.[] | select(.title==env.MS) | .number'],
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
    mirror: { number: 84, title: `Sprint mirror: ${mirrorCreate.sprint}`, body: mirrorUpdateBody },
    progress: {
      "Progress: June 2026": {
        number: 90, title: "Progress: June 2026", body: progress.body, state: "closed",
      },
    },
    comments: [{ id: 501, body: mergeComment }],
    milestoneClosed: true,
  });
}

function runLocalCycle(fixture) {
  const body = "\n## Description\nHuman local body\n\n## Acceptance Criteria\n- [ ] Keep this AC\n";
  const created = runWorker(fixture, "create", { id: "7.2", title: "Offline canonical task", body });
  assert.deepEqual(created, { tracker: "local", id: "7.2", ref: "BACK-7.2" });
  const taskPath = path.join(fixture.backlogDir, "tasks", "BACK-7.2 - offline-canonical-task.md");
  assert.equal(fs.readFileSync(taskPath, "utf8").endsWith(body), true);

  const sprintPath = writeLocalSprint(fixture, created);
  const { status, next } = orient(fixture);
  assert.deepEqual(status.plan_items.map(({ tracker, id, ref, issue_number }) => ({ tracker, id, ref, issue_number })), [
    { tracker: "local", id: "7.2", ref: "BACK-7.2", issue_number: null },
  ]);
  assert.equal(next.next_batch.items[0].ref, "BACK-7.2");
  assert.equal(runWorker(fixture, "read", { selector: "BACK-7.2" }).body, body);

  const bodyBefore = fs.readFileSync(taskPath, "utf8").slice(fs.readFileSync(taskPath, "utf8").indexOf("\n## Description"));
  runWorker(fixture, "update", { selector: "BACK-7.2", changes: { status: "In Progress" } });
  const afterUpdate = fs.readFileSync(taskPath, "utf8");
  assert.match(afterUpdate, /^status: In Progress$/m);
  assert.equal(afterUpdate.slice(afterUpdate.indexOf("\n## Description")), bodyBefore);

  runWorker(fixture, "close", { selector: "BACK-7.2" });
  const archivedPath = path.join(fixture.backlogDir, "completed", "BACK-7.2 - offline-canonical-task.md");
  assert.equal(fs.existsSync(taskPath), false);
  assert.match(fs.readFileSync(archivedPath, "utf8"), /^status: Done$/m);
  assert.equal(fs.readFileSync(archivedPath, "utf8").slice(fs.readFileSync(archivedPath, "utf8").indexOf("\n## Description")), bodyBefore);

  finishSprint(fixture, sprintPath);
  assert.deepEqual(runWorker(fixture, "list", { state: "open" }), []);
  assert.equal(runWorker(fixture, "list", { state: "closed" })[0].ref, "BACK-7.2");
  const finalRead = runWorker(fixture, "read", { selector: "BACK-7.2" });
  assert.equal(finalRead.state, "closed");
  assert.equal(finalRead.status, "Done");
  assert.deepEqual(fixture.providerCalls(), [], "local cycle must make zero provider calls");
}

describe("tracker core cycle acceptance matrix", () => {
  for (const row of CYCLE_ROWS) {
    it(`${row.tracker}: setup/config → create → Plan → orient/read → update → complete → final read/list`, (t) => {
      const fixture = row.prepare(t);
      if (row.tracker === "github") runGithubCycle(fixture);
      else runLocalCycle(fixture);
    });
  }
});

describe("typed unsupported-capability contract", () => {
  for (const capability of trackerModule.CAPABILITY_NAMES) {
    it(`local ${capability} fails before side effects with the shared serialized shape`, (t) => {
      const fixture = prepareLocal(t);
      const resolved = trackerModule.resolveConfiguredTracker({ tracker: "local" }, { backlogDir: fixture.backlogDir });
      let sideEffects = 0;
      let caught;
      try {
        trackerModule.invokeCapability(resolved, capability, () => { sideEffects += 1; });
      } catch (error) {
        caught = error;
      }
      assert.equal(sideEffects, 0);
      assert.ok(caught instanceof trackerModule.UnsupportedTrackerCapabilityError);
      assert.equal(typeof trackerModule.serializeTrackerError, "function");
      assert.deepEqual(trackerModule.serializeTrackerError(caught), {
        code: "TRACKER_CAPABILITY_UNSUPPORTED",
        tracker: "local",
        capability,
        message: `Tracker "local" does not support capability "${capability}".`,
        remediation: `Use tracker "local" without "${capability}", or explicitly change ${path.join(fixture.backlogDir, "config.yml")} to a tracker that supports it before retrying. No tracker switch was attempted.`,
      });
      assert.deepEqual(fixture.providerCalls(), []);
    });
  }
});

describe("unsupported capability public CLI boundaries", () => {
  const boundaries = [
    { name: "sprint-init", script: SPRINT_INIT_PATH, args: () => ["blocked", "--json"], capability: "milestones", configPath: () => "backlog/config.yml" },
    { name: "sprint-mirror", script: SPRINT_MIRROR_PATH, args: (fixture) => [fixture.backlogDir, "--json"], capability: "mirrors", configPath: (fixture) => path.join(fixture.backlogDir, "config.yml") },
    { name: "progress-sync", script: PROGRESS_SYNC_PATH, args: () => ["--month", "2026-06", "--json"], capability: "progress-issues", configPath: () => "backlog/config.yml" },
  ];

  for (const boundary of boundaries) {
    it(`${boundary.name} emits one structured JSON error and matching human remediation`, (t) => {
      const fixture = prepareLocal(t);
      const before = snapshotFiles(fixture.backlogDir);
      const boundaryArgs = boundary.args(fixture);
      const json = run(process.execPath, [boundary.script, ...boundaryArgs], fixture);
      assert.notEqual(json.status, 0);
      assert.equal(json.stderr, "");
      const payload = JSON.parse(json.stdout);
      assert.deepEqual(Object.keys(payload), ["error"]);
      assert.deepEqual(payload.error, {
        code: "TRACKER_CAPABILITY_UNSUPPORTED",
        tracker: "local",
        capability: boundary.capability,
        message: `Tracker "local" does not support capability "${boundary.capability}".`,
        remediation: `Use tracker "local" without "${boundary.capability}", or explicitly change ${boundary.configPath(fixture)} to a tracker that supports it before retrying. No tracker switch was attempted.`,
      });

      const humanArgs = boundaryArgs.filter((arg) => arg !== "--json");
      const human = run(process.execPath, [boundary.script, ...humanArgs], fixture);
      assert.notEqual(human.status, 0);
      assert.match(human.stderr, new RegExp(escapeRegExp(payload.error.remediation)));
      assert.deepEqual(snapshotFiles(fixture.backlogDir), before, "capability failure must precede side effects");
      assert.deepEqual(fixture.providerCalls(), [], "capability failure must not call gh");
      assert.match(fs.readFileSync(path.join(fixture.backlogDir, "config.yml"), "utf8"), /^tracker: local$/m);
    });
  }
});

function snapshotFiles(root) {
  const snapshot = {};
  function walk(dir, relative = "") {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const key = path.join(relative, name);
      const stat = fs.lstatSync(full);
      if (stat.isDirectory()) walk(full, key);
      else snapshot[key] = fs.readFileSync(full).toString("base64");
    }
  }
  walk(root);
  return snapshot;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
