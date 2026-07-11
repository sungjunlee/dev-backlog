const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createLocalAdapter,
  LocalStoreError,
} = require("./local-tracker.js");
const { REQUIRED_ADAPTER_OPERATIONS } = require("./tracker.js");

const FIXED_NOW = () => new Date("2026-07-11T09:00:00Z");

function makeStore(t, { seedTasks = [], seedCompleted = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-tracker-"));
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(path.join(backlogDir, "tasks"), { recursive: true });
  fs.mkdirSync(path.join(backlogDir, "completed"), { recursive: true });
  fs.writeFileSync(
    path.join(backlogDir, "config.yml"),
    'tracker: local\ntask_prefix: "BACK"\ndefault_status: "To Do"\nstatuses: ["To Do", "In Progress", "Done"]\n'
  );
  for (const [name, content] of seedTasks) {
    fs.writeFileSync(path.join(backlogDir, "tasks", name), content);
  }
  for (const [name, content] of seedCompleted) {
    fs.writeFileSync(path.join(backlogDir, "completed", name), content);
  }
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, backlogDir, adapter: createLocalAdapter({ backlogDir, now: FIXED_NOW }) };
}

function taskFile({ id, title, status = "To Do", body = "\n## Description\nseed body\n" }) {
  return (
    `---\n` +
    `id: BACK-${id}\n` +
    `title: ${title}\n` +
    `status: ${status}\n` +
    `labels: []\n` +
    `priority: medium\n` +
    `created_date: '2026-07-01'\n` +
    `---` +
    body
  );
}

function read(backlogDir, dir, name) {
  return fs.readFileSync(path.join(backlogDir, dir, name), "utf-8");
}

function listNames(backlogDir, dir) {
  return fs.readdirSync(path.join(backlogDir, dir)).filter((f) => f.endsWith(".md")).sort();
}

describe("local adapter shape and authority", () => {
  it("exposes exactly the seven required operations and empty capabilities", (t) => {
    const { adapter } = makeStore(t);
    assert.deepEqual(Object.keys(adapter), REQUIRED_ADAPTER_OPERATIONS);
    assert.deepEqual(adapter.capabilities(), []);
    assert.deepEqual(adapter.availability(), { available: true });
  });

  it("reports an actionable unavailable reason for a malformed store without fallback", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-tracker-bad-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const filePath = path.join(root, "not-a-dir");
    fs.writeFileSync(filePath, "i am a file");
    const adapter = createLocalAdapter({ backlogDir: filePath, now: FIXED_NOW });
    const report = adapter.availability();
    assert.equal(report.available, false);
    assert.ok(typeof report.reason === "string" && report.reason.trim().length > 0);
  });
});

describe("local create — allocation, atomic publish, identity", () => {
  it("allocates the next positive parent id and returns a normalized url-free identity", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    const first = adapter.create({ title: "First task" });
    assert.deepEqual(first, { tracker: "local", id: "1", ref: "BACK-1" });
    assert.equal(Object.prototype.hasOwnProperty.call(first, "url"), false);

    const second = adapter.create({ title: "Second task" });
    assert.equal(second.id, "2");
    assert.deepEqual(listNames(backlogDir, "tasks"), [
      "BACK-1 - first-task.md",
      "BACK-2 - second-task.md",
    ]);
  });

  it("allocates across active and completed exact-prefix files", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [["BACK-3 - active.md", taskFile({ id: 3, title: "Active" })]],
      seedCompleted: [["BACK-7 - done.md", taskFile({ id: 7, title: "Done", status: "Done" })]],
    });
    assert.equal(adapter.create({ title: "Next" }).id, "8");
  });

  it("keeps BACK-1 and BACK-11 distinct when choosing the next id", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [
        ["BACK-1 - one.md", taskFile({ id: 1, title: "One" })],
        ["BACK-11 - eleven.md", taskFile({ id: 11, title: "Eleven" })],
      ],
    });
    assert.equal(adapter.create({ title: "After" }).id, "12");
    assert.equal(adapter.read("BACK-1").id, "1");
    assert.equal(adapter.read("BACK-11").id, "11");
  });

  it("creates an explicit free decimal subtask without disturbing parent allocation", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - parent.md", taskFile({ id: 1, title: "Parent" })]],
    });
    const sub = adapter.create({ title: "Child", id: "1.2" });
    assert.deepEqual(sub, { tracker: "local", id: "1.2", ref: "BACK-1.2" });
    assert.ok(fs.existsSync(path.join(backlogDir, "tasks", "BACK-1.2 - child.md")));
    // parent allocation still counts only integer parents
    assert.equal(adapter.create({ title: "Sibling" }).id, "2");
  });

  it("refuses an explicit id that already exists and leaves the store untouched", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - parent.md", taskFile({ id: 1, title: "Parent" })]],
    });
    const before = read(backlogDir, "tasks", "BACK-1 - parent.md");
    assert.throws(() => adapter.create({ title: "Dup", id: "1" }), LocalStoreError);
    assert.equal(read(backlogDir, "tasks", "BACK-1 - parent.md"), before);
    assert.deepEqual(listNames(backlogDir, "tasks"), ["BACK-1 - parent.md"]);
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")));
  });

  it("rejects missing/blank titles before any filesystem mutation", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    for (const bad of [undefined, "", "   ", 5, null]) {
      assert.throws(() => adapter.create({ title: bad }), LocalStoreError);
    }
    assert.deepEqual(listNames(backlogDir, "tasks"), []);
  });

  it("rejects an explicit foreign-prefix or malformed id", (t) => {
    const { adapter } = makeStore(t);
    for (const bad of ["OTHER-1", "BACK-1", "0", "1.0", "1.2.3", "-1", "x"]) {
      assert.throws(() => adapter.create({ title: "T", id: bad }), LocalStoreError);
    }
  });
});

describe("local list and read", () => {
  it("lists open, closed, and all exact-prefix tasks and skips foreign/malformed files", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [
        ["BACK-1 - one.md", taskFile({ id: 1, title: "One" })],
        ["BACK-2 - two.md", taskFile({ id: 2, title: "Two", status: "In Progress" })],
        ["OTHER-9 - foreign.md", taskFile({ id: 9, title: "Foreign" })],
        ["not-a-task.md", "no frontmatter here"],
      ],
      seedCompleted: [
        ["BACK-5 - five.md", taskFile({ id: 5, title: "Five", status: "Done" })],
      ],
    });

    const open = adapter.list();
    assert.deepEqual(open.map((t2) => t2.ref), ["BACK-1", "BACK-2"]);
    assert.equal(open.every((t2) => t2.tracker === "local" && t2.state === "open"), true);
    assert.equal(open.every((t2) => !("url" in t2)), true);

    const closed = adapter.list({ state: "closed" });
    assert.deepEqual(closed.map((t2) => t2.ref), ["BACK-5"]);
    assert.equal(closed[0].state, "closed");

    const all = adapter.list({ state: "all" });
    assert.deepEqual(all.map((t2) => t2.ref), ["BACK-1", "BACK-2", "BACK-5"]);
  });

  it("reads one task by identity, ref string, or bare id and exposes neutral fields", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [["BACK-2 - two.md", taskFile({ id: 2, title: "Two", status: "In Progress" })]],
      seedCompleted: [["BACK-5 - five.md", taskFile({ id: 5, title: "Five", status: "Done" })]],
    });
    for (const selector of ["BACK-2", "2", { tracker: "local", id: "2", ref: "BACK-2" }]) {
      const task = adapter.read(selector);
      assert.equal(task.id, "2");
      assert.equal(task.title, "Two");
      assert.equal(task.status, "In Progress");
      assert.equal(task.state, "open");
      assert.equal("url" in task, false);
    }
    assert.equal(adapter.read("BACK-5").state, "closed");
  });

  it("does not mutate files during list/read", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
    });
    const before = read(backlogDir, "tasks", "BACK-1 - one.md");
    adapter.list({ state: "all" });
    adapter.read("BACK-1");
    assert.equal(read(backlogDir, "tasks", "BACK-1 - one.md"), before);
  });

  it("rejects a foreign-prefix read selector rather than inferring it", (t) => {
    const { adapter } = makeStore(t);
    assert.throws(() => adapter.read("OTHER-1"), LocalStoreError);
    assert.throws(() => adapter.read("BACK-404"), LocalStoreError);
  });
});

describe("local update — metadata/state without body loss", () => {
  it("changes only requested fields and preserves body/AC bytes exactly", (t) => {
    const body =
      "\n## Description\nHuman authored prose with UTF-8 ☕ and trailing spaces.  \n" +
      "\n## Acceptance Criteria\n<!-- AC:BEGIN -->\n- [x] done item\n- [ ] pending item\n<!-- AC:END -->\n";
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One", body })]],
    });
    const original = read(backlogDir, "tasks", "BACK-1 - one.md");
    const originalBody = original.slice(original.indexOf("\n## Description"));

    adapter.update("BACK-1", { status: "In Progress" });
    const updated = read(backlogDir, "tasks", "BACK-1 - one.md");
    const updatedBody = updated.slice(updated.indexOf("\n## Description"));

    assert.equal(updatedBody, originalBody, "body bytes must be preserved");
    assert.match(updated, /^status: In Progress$/m);
    assert.equal(adapter.read("BACK-1").status, "In Progress");
  });

  it("preserves unrelated frontmatter and only rewrites the requested keys", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
    });
    adapter.update("BACK-1", { labels: ["infra", "urgent"], priority: "high" });
    const updated = read(backlogDir, "tasks", "BACK-1 - one.md");
    assert.match(updated, /^priority: high$/m);
    assert.match(updated, /^labels:\n {2}- infra\n {2}- urgent$/m);
    assert.match(updated, /^created_date: '2026-07-01'$/m);
    assert.match(updated, /^id: BACK-1$/m);
  });

  it("replaces the body only when the caller supplies one explicitly", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
    });
    adapter.update("BACK-1", { body: "\n## Description\nrewritten by caller\n" });
    const updated = read(backlogDir, "tasks", "BACK-1 - one.md");
    assert.match(updated, /rewritten by caller/);
  });

  it("refuses to update a task that is not active", (t) => {
    const { adapter } = makeStore(t, {
      seedCompleted: [["BACK-5 - five.md", taskFile({ id: 5, title: "Five", status: "Done" })]],
    });
    assert.throws(() => adapter.update("BACK-5", { status: "To Do" }), LocalStoreError);
    assert.throws(() => adapter.update("BACK-404", { status: "To Do" }), LocalStoreError);
  });
});

describe("local close — exact archive without overwrite", () => {
  it("moves exactly one active task to completed with status Done and preserved body", (t) => {
    const body = "\n## Description\nkeep me\n";
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One", body })]],
    });
    const closed = adapter.close("BACK-1");
    assert.deepEqual(closed, { tracker: "local", id: "1", ref: "BACK-1" });
    assert.deepEqual(listNames(backlogDir, "tasks"), []);
    assert.deepEqual(listNames(backlogDir, "completed"), ["BACK-1 - one.md"]);
    const archived = read(backlogDir, "completed", "BACK-1 - one.md");
    assert.match(archived, /^status: Done$/m);
    assert.ok(archived.includes("keep me"));
  });

  it("refuses to overwrite an existing completed destination and keeps both files", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One", body: "\n## Description\nactive\n" })]],
      seedCompleted: [["BACK-1 - one.md", taskFile({ id: 1, title: "One", status: "Done", body: "\n## Description\narchived\n" })]],
    });
    const beforeCompleted = read(backlogDir, "completed", "BACK-1 - one.md");
    assert.throws(() => adapter.close("BACK-1"), LocalStoreError);
    assert.equal(read(backlogDir, "completed", "BACK-1 - one.md"), beforeCompleted);
    assert.ok(fs.existsSync(path.join(backlogDir, "tasks", "BACK-1 - one.md")));
  });

  it("is idempotent when the task is already closed", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedCompleted: [["BACK-5 - five.md", taskFile({ id: 5, title: "Five", status: "Done" })]],
    });
    const before = read(backlogDir, "completed", "BACK-5 - five.md");
    const result = adapter.close("BACK-5");
    assert.deepEqual(result, { tracker: "local", id: "5", ref: "BACK-5" });
    assert.equal(read(backlogDir, "completed", "BACK-5 - five.md"), before);
  });

  it("throws for a task that exists in neither store", (t) => {
    const { adapter } = makeStore(t);
    assert.throws(() => adapter.close("BACK-404"), LocalStoreError);
  });
});

describe("local authority — no capabilities and no gh", () => {
  it("runs a full create/read/update/close cycle without invoking gh", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "local-tracker-bin-"));
    t.after(() => fs.rmSync(binDir, { recursive: true, force: true }));
    const marker = path.join(binDir, "gh-was-called");
    fs.writeFileSync(path.join(binDir, "gh"), `#!/bin/sh\ntouch "${marker}"\nexit 1\n`);
    fs.chmodSync(path.join(binDir, "gh"), 0o755);

    const savedPath = process.env.PATH;
    process.env.PATH = `${binDir}:${savedPath}`;
    t.after(() => {
      process.env.PATH = savedPath;
    });

    const id = adapter.create({ title: "Cycle" });
    adapter.read(id);
    adapter.update(id, { status: "In Progress" });
    adapter.close(id);

    assert.equal(fs.existsSync(marker), false, "gh must never be invoked by the local adapter");
    assert.deepEqual(listNames(backlogDir, "completed"), ["BACK-1 - cycle.md"]);
  });

  it("reports no optional capabilities", (t) => {
    const { adapter } = makeStore(t);
    assert.deepEqual(adapter.capabilities(), []);
  });
});

describe("local allocation critical section", () => {
  it("fails clearly on lock contention and never removes a lock it does not own", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    const contended = createLocalAdapter({
      backlogDir,
      now: FIXED_NOW,
      lock: { retries: 0, delayMs: 1 },
    });
    const lockPath = path.join(backlogDir, ".local-tracker.lock");
    fs.writeFileSync(lockPath, String(process.pid));
    assert.throws(() => contended.create({ title: "Blocked" }), LocalStoreError);
    assert.ok(fs.existsSync(lockPath), "foreign lock must be preserved");
    assert.deepEqual(listNames(backlogDir, "tasks"), []);

    fs.unlinkSync(lockPath);
    assert.equal(adapter.create({ title: "After release" }).id, "1");
    assert.ok(!fs.existsSync(lockPath), "lock is released on the success path");
  });

  it("cleans up the lock and temp files when publication fails mid-operation", (t) => {
    const { backlogDir } = makeStore(t);
    const adapter = createLocalAdapter({
      backlogDir,
      now: FIXED_NOW,
      testHooks: {
        beforePublish() {
          throw new Error("injected publish failure");
        },
      },
    });
    assert.throws(() => adapter.create({ title: "Boom" }));
    assert.deepEqual(listNames(backlogDir, "tasks"), []);
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")));
    const strays = fs.readdirSync(path.join(backlogDir, "tasks")).filter((f) => f.includes(".tmp"));
    assert.deepEqual(strays, []);
  });
});
