const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  TRACKER_ADAPTERS,
  createFilesAdapter,
  resolveConfiguredTracker,
  resolveTracker,
  validateAdapter,
  validateIdentity,
} = require(path.join(SKILL_SCRIPTS, "tracker.js"));
const {
  FILES_EXEC_DEFAULTS,
  filesIdentity,
  normalizeFilesTask,
} = require(path.join(SKILL_SCRIPTS, "files-tracker.js"));
const { writeBacklogFixture } = require(path.join(SKILL_SCRIPTS, "fake-backlog-fixture.js"));

function recordingExec(responses) {
  const calls = [];
  const execFile = (command, args, options) => {
    calls.push({ command, args, options });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  };
  return { calls, execFile };
}

function enoent(message = "spawn backlog ENOENT") {
  const error = new Error(message);
  error.code = "ENOENT";
  return error;
}

function listEnvelope(tasks) {
  return JSON.stringify({ schemaVersion: 1, kind: "task-list", tasks });
}

function viewEnvelope(task) {
  return JSON.stringify({ schemaVersion: 1, kind: "task-view", task });
}

function identityOf(task) {
  const identity = {
    tracker: task.tracker,
    id: task.id,
    ref: task.ref,
  };
  if (task.url !== undefined) identity.url = task.url;
  return identity;
}

describe("files required lifecycle adapter", () => {
  it("has exactly the required shape and under-claims capabilities", () => {
    const adapter = createFilesAdapter({ execFile: () => listEnvelope([]) });

    assert.deepEqual(Object.keys(adapter), [
      "availability",
      "capabilities",
      "list",
      "read",
      "create",
      "update",
      "close",
    ]);
    assert.equal(validateAdapter("files", adapter), adapter);
    assert.deepEqual(adapter.availability(), { available: true });
    assert.deepEqual(adapter.capabilities(), ["comments"]);
    assert.equal(adapter.capabilities().includes("pull-request-relationships"), false);
    assert.equal(adapter.capabilities().includes("closing-semantics"), false);
    assert.equal(adapter.capabilities().includes("milestones"), false);
  });

  it("reports available:false with a reason when the CLI is missing (never throws)", () => {
    const adapter = createFilesAdapter({ execFile: () => { throw enoent(); } });
    const report = adapter.availability();
    assert.equal(report.available, false);
    assert.match(report.reason, /ENOENT/);
    assert.match(report.reason, /backlog/);
  });

  it("reports available:false when the probe command fails", () => {
    const adapter = createFilesAdapter({
      execFile: () => { throw new Error("backlog: not a repo"); },
    });
    const report = adapter.availability();
    assert.equal(report.available, false);
    assert.match(report.reason, /not a repo/);
  });

  it("reports available:false when the probe envelope is not a task-list", () => {
    const adapter = createFilesAdapter({
      execFile: () => JSON.stringify({ schemaVersion: 1, kind: "search", results: [] }),
    });
    const report = adapter.availability();
    assert.equal(report.available, false);
    assert.match(report.reason, /unexpected JSON envelope/);
  });

  it("lists tasks through CLI JSON and normalizes BACK-N identities", () => {
    const listed = [{
      id: "BACK-12",
      title: "Files adapter",
      status: "To Do",
      labels: ["feature"],
    }];
    const { calls, execFile } = recordingExec([listEnvelope(listed)]);
    const adapter = createFilesAdapter({ execFile });

    const tasks = adapter.list({ state: "open", limit: 20 });

    assert.deepEqual(calls, [{
      command: "backlog",
      args: ["task", "list", "--json", "--limit", "20"],
      options: FILES_EXEC_DEFAULTS,
    }]);
    assert.deepEqual(identityOf(tasks[0]), {
      tracker: "files",
      id: "12",
      ref: "BACK-12",
    });
    assert.equal(tasks[0].title, "Files adapter");
    assert.equal(tasks[0].status, "To Do");
    assert.deepEqual(validateIdentity(identityOf(tasks[0])), identityOf(tasks[0]));
  });

  it("maps closed list state to Done status and preserves decimal ids", () => {
    const listed = [{ id: "BACK-12.1", title: "Child", status: "Done" }];
    const { calls, execFile } = recordingExec([listEnvelope(listed)]);
    const adapter = createFilesAdapter({ execFile });

    const tasks = adapter.list({ state: "closed" });
    assert.deepEqual(calls[0].args, ["task", "list", "--json", "--status", "Done"]);
    assert.deepEqual(identityOf(tasks[0]), {
      tracker: "files",
      id: "12.1",
      ref: "BACK-12.1",
    });
  });

  it("reads one task with exact argv and normalized identity", () => {
    const task = {
      id: "BACK-12",
      title: "Files adapter",
      description: "body",
      status: "In Progress",
      labels: [],
      acceptanceCriteria: [{ index: 1, text: "CLI only", checked: false }],
    };
    const { calls, execFile } = recordingExec([viewEnvelope(task)]);
    const adapter = createFilesAdapter({ execFile });

    const read = adapter.read({ tracker: "files", id: "12", ref: "BACK-12" });

    assert.deepEqual(calls, [{
      command: "backlog",
      args: ["task", "view", "12", "--json"],
      options: FILES_EXEC_DEFAULTS,
    }]);
    assert.equal(read.tracker, "files");
    assert.equal(read.id, "12");
    assert.equal(read.ref, "BACK-12");
    assert.equal(read.body, "body");
    assert.equal(read.description, "body");
    assert.deepEqual(read.acceptanceCriteria, task.acceptanceCriteria);
  });

  it("creates, updates, and closes through injected execution with BACK-N identity", () => {
    const { calls, execFile } = recordingExec([
      "Created task BACK-12\n",
      "",
      "",
    ]);
    const adapter = createFilesAdapter({ execFile });

    const created = adapter.create({
      title: "Ship files adapter",
      body: "CLI only",
      acceptanceCriteria: ["No markdown parser"],
    });
    const updated = adapter.update(created, {
      title: "Ship files adapter",
      body: "CLI only, fail-closed",
      status: "In Progress",
    });
    const closed = adapter.close(updated);

    assert.deepEqual(calls, [
      {
        command: "backlog",
        args: [
          "task", "create", "Ship files adapter", "-d", "CLI only",
          "--ac", "No markdown parser",
        ],
        options: FILES_EXEC_DEFAULTS,
      },
      {
        command: "backlog",
        args: [
          "task", "edit", "12", "-t", "Ship files adapter",
          "-d", "CLI only, fail-closed", "-s", "In Progress",
        ],
        options: FILES_EXEC_DEFAULTS,
      },
      {
        command: "backlog",
        args: ["task", "edit", "12", "-s", "Done"],
        options: FILES_EXEC_DEFAULTS,
      },
    ]);
    const identity = { tracker: "files", id: "12", ref: "BACK-12" };
    assert.deepEqual(created, identity);
    assert.deepEqual(updated, identity);
    assert.deepEqual(closed, identity);
  });

  it("does not read backlog/tasks markdown as the product API", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "files-no-md-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const leftover = path.join(root, "backlog", "tasks", "BACK-99 - leftover.md");
    fs.mkdirSync(path.dirname(leftover), { recursive: true });
    fs.writeFileSync(leftover, "not authority\n");

    const { calls, execFile } = recordingExec([listEnvelope([])]);
    const adapter = createFilesAdapter({ execFile });
    assert.deepEqual(adapter.list(), []);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "backlog");
    assert.equal(String(calls[0].args).includes("tasks"), false);
    assert.equal(fs.readFileSync(leftover, "utf8"), "not authority\n");
  });

  it("propagates configured files transport failure without consulting GitHub", () => {
    const { execFile } = recordingExec([
      listEnvelope([]),
      new Error("backlog transport failed"),
    ]);
    const files = createFilesAdapter({
      execFile: (command, args, options) => {
        if (command !== "backlog") throw new Error("must not call another provider");
        return execFile(command, args, options);
      },
    });
    const resolved = resolveTracker({ tracker: "files" }, {
      adapters: { files, github: TRACKER_ADAPTERS.github },
    });

    assert.throws(() => resolved.adapter.list({ limit: 1 }), /backlog transport failed/);
  });
});

describe("files identity helpers", () => {
  it("accepts prefixed and bare ids and rejects malformed values", () => {
    assert.deepEqual(filesIdentity("BACK-12"), { tracker: "files", id: "12", ref: "BACK-12" });
    assert.deepEqual(filesIdentity("12.1"), { tracker: "files", id: "12.1", ref: "BACK-12.1" });
    assert.throws(() => filesIdentity("0"), /Invalid files task id/);
    assert.throws(() => filesIdentity("12.0"), /Invalid files task id/);
    assert.throws(
      () => normalizeFilesTask({ id: "BACK-1", url: "not-a-url" }),
      /Invalid files task URL/,
    );
  });
});

describe("files adapter fake-backlog acceptance", () => {
  it("runs list → create → update → close without a real CLI", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "files-fake-cycle-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const fixture = writeBacklogFixture(root);
    const execFile = (command, args, options = {}) => {
      assert.equal(command, "backlog");
      return execFileSync(process.execPath, [fixture.backlogPath, ...args], {
        ...options,
        env: { ...fixture.env, ...(options.env || {}) },
      });
    };
    const adapter = createFilesAdapter({ execFile });

    assert.deepEqual(adapter.availability(), { available: true });
    assert.deepEqual(adapter.list(), []);

    const created = adapter.create({ title: "Cycle task", body: "via CLI" });
    assert.deepEqual(created, { tracker: "files", id: "12", ref: "BACK-12" });

    const listed = adapter.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].ref, "BACK-12");
    assert.equal(listed[0].title, "Cycle task");

    adapter.update(created, { title: "Cycle task renamed", status: "In Progress" });
    const read = adapter.read(created);
    assert.equal(read.title, "Cycle task renamed");
    assert.equal(read.status, "In Progress");
    assert.equal(read.body, "via CLI");

    adapter.close(created);
    assert.equal(adapter.read(created).status, "Done");
    assert.equal(fixture.state().tasks[0].status, "Done");
  });

  it("is unavailable when PATH has no backlog binary", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "files-missing-cli-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const emptyBin = path.join(root, "empty-bin");
    fs.mkdirSync(emptyBin);
    const adapter = createFilesAdapter({
      execFile: (command, args, options = {}) => execFileSync(command, args, {
        ...options,
        env: { ...process.env, PATH: emptyBin },
      }),
    });
    const report = adapter.availability();
    assert.equal(report.available, false);
    assert.match(report.reason, /ENOENT|not found|backlog/i);
  });

  it("injects execFile for the files adapter through resolveConfiguredTracker", () => {
    const { execFile } = recordingExec([listEnvelope([])]);
    const resolved = resolveConfiguredTracker({ tracker: "files" }, { execFile });
    assert.equal(resolved.tracker, "files");
    assert.deepEqual(resolved.availability, { available: true });
  });
});
