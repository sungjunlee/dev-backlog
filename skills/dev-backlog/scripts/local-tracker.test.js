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

  it("serializes update and close on the same store lock as create", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
    });
    const contended = createLocalAdapter({
      backlogDir,
      now: FIXED_NOW,
      lock: { retries: 0, delayMs: 1 },
    });
    const lockPath = path.join(backlogDir, ".local-tracker.lock");
    fs.writeFileSync(lockPath, String(process.pid));

    // A held store lock blocks update and close, not just create.
    assert.throws(() => contended.update("BACK-1", { status: "In Progress" }), LocalStoreError);
    assert.throws(() => contended.close("BACK-1"), LocalStoreError);
    assert.match(read(backlogDir, "tasks", "BACK-1 - one.md"), /^status: To Do$/m);

    fs.unlinkSync(lockPath);
    adapter.update("BACK-1", { status: "In Progress" });
    assert.ok(!fs.existsSync(lockPath), "update releases the store lock");
    adapter.close("BACK-1");
    assert.ok(!fs.existsSync(lockPath), "close releases the store lock");
    assert.deepEqual(listNames(backlogDir, "completed"), ["BACK-1 - one.md"]);
  });
});

describe("local canonical identity — fail closed on corruption", () => {
  it("treats duplicate same-id files in one store as corruption", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [
        ["BACK-1 - one.md", taskFile({ id: 1, title: "One" })],
        ["BACK-1 - dup.md", taskFile({ id: 1, title: "Dup" })],
      ],
    });
    assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
    assert.throws(() => adapter.list(), LocalStoreError);
  });

  it("rejects a filename/frontmatter id mismatch rather than trusting the filename", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 2, title: "Mismatch" })]],
    });
    assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
    assert.throws(() => adapter.list(), LocalStoreError);
  });

  it("rejects the same id living in both active and completed stores", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [["BACK-1 - active.md", taskFile({ id: 1, title: "Active" })]],
      seedCompleted: [["BACK-1 - archived.md", taskFile({ id: 1, title: "Archived", status: "Done" })]],
    });
    assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
    assert.throws(() => adapter.list({ state: "all" }), LocalStoreError);
  });
});

describe("local store-wide exact-id uniqueness on close", () => {
  it("refuses to archive over a completed twin with a different slug and preserves bytes", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - active-slug.md", taskFile({ id: 1, title: "Active", body: "\n## Description\nactive\n" })]],
      seedCompleted: [["BACK-1 - other-slug.md", taskFile({ id: 1, title: "Other", status: "Done", body: "\n## Description\narchived\n" })]],
    });
    const activeBefore = read(backlogDir, "tasks", "BACK-1 - active-slug.md");
    const completedBefore = read(backlogDir, "completed", "BACK-1 - other-slug.md");
    assert.throws(() => adapter.close("BACK-1"), LocalStoreError);
    assert.equal(read(backlogDir, "tasks", "BACK-1 - active-slug.md"), activeBefore);
    assert.equal(read(backlogDir, "completed", "BACK-1 - other-slug.md"), completedBefore);
    assert.deepEqual(listNames(backlogDir, "completed"), ["BACK-1 - other-slug.md"]);
  });
});

describe("local rendered metadata round-trips through read", () => {
  it("reads back non-empty labels and dependencies as arrays, not malformed objects", (t) => {
    const { adapter } = makeStore(t);
    adapter.create({
      title: "Meta",
      labels: ["infra", "urgent"],
      dependencies: ["BACK-9", "BACK-8"],
    });
    const task = adapter.read("BACK-1");
    assert.deepEqual(task.labels, ["infra", "urgent"]);
    assert.deepEqual(task.dependencies, ["BACK-9", "BACK-8"]);
    const listed = adapter.list().find((entry) => entry.ref === "BACK-1");
    assert.deepEqual(listed.labels, ["infra", "urgent"]);
    assert.deepEqual(listed.dependencies, ["BACK-9", "BACK-8"]);
  });
});

describe("local body normalization", () => {
  it("normalizes a create body without a leading newline into a readable task", (t) => {
    const { adapter } = makeStore(t);
    adapter.create({ title: "Plain", body: "just plain text without a leading newline" });
    const task = adapter.read("BACK-1");
    assert.match(task.body, /just plain text without a leading newline/);
    assert.ok(task.body.startsWith("\n"), "body is separated from the frontmatter fence");
  });

  it("normalizes an update body without a leading newline", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
    });
    adapter.update("BACK-1", { body: "replacement without a leading newline" });
    const task = adapter.read("BACK-1");
    assert.match(task.body, /replacement without a leading newline/);
  });
});

describe("local canonical directory containment", () => {
  it("rejects a task_prefix that could escape tasks/completed and reports unavailable", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-tracker-esc-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(path.join(backlogDir, "tasks"), { recursive: true });
    fs.mkdirSync(path.join(backlogDir, "completed"), { recursive: true });

    for (const bad of ["../ESC", "a/b", "a\\b", "..", "with space"]) {
      const adapter = createLocalAdapter({ backlogDir, config: { task_prefix: bad }, now: FIXED_NOW });
      assert.equal(adapter.availability().available, false, `prefix ${JSON.stringify(bad)} must be unavailable`);
      assert.throws(() => adapter.create({ title: "Escape" }), LocalStoreError);
    }

    // Nothing escaped the canonical directories.
    assert.deepEqual(fs.readdirSync(backlogDir).filter((name) => name.includes("ESC")), []);
    assert.deepEqual(listNames(backlogDir, "tasks"), []);
  });
});

describe("local pre-mutation unsupported-option failures", () => {
  it("rejects provider-specific options on create, update, and close before mutating", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
    });
    const before = read(backlogDir, "tasks", "BACK-1 - one.md");

    assert.throws(() => adapter.create({ title: "Milestoned", milestone: "v1" }), LocalStoreError);
    assert.throws(() => adapter.update("BACK-1", { status: "Done", milestone: "v1" }), LocalStoreError);
    assert.throws(() => adapter.close("BACK-1", { reason: "done enough" }), LocalStoreError);

    assert.equal(read(backlogDir, "tasks", "BACK-1 - one.md"), before, "no option-rejected mutation touched bytes");
    assert.deepEqual(listNames(backlogDir, "tasks"), ["BACK-1 - one.md"]);
    assert.deepEqual(listNames(backlogDir, "completed"), []);
  });
});

function strays(backlogDir, dir) {
  return fs.readdirSync(path.join(backlogDir, dir)).filter((name) => name.includes(".tmp"));
}

describe("local close — unlink failure compensation and recovery", () => {
  it("rolls back the completed publication when the source unlink fails", (t) => {
    const { backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One", body: "\n## Description\nkeep\n" })]],
    });
    const adapter = createLocalAdapter({
      backlogDir,
      now: FIXED_NOW,
      testHooks: {
        beforeUnlinkSource() {
          throw new Error("injected source unlink failure");
        },
      },
    });
    const before = read(backlogDir, "tasks", "BACK-1 - one.md");
    assert.throws(() => adapter.close("BACK-1"), LocalStoreError);

    // Exactly one intact authoritative copy remains: the byte-identical active source.
    assert.equal(read(backlogDir, "tasks", "BACK-1 - one.md"), before);
    assert.deepEqual(listNames(backlogDir, "tasks"), ["BACK-1 - one.md"]);
    assert.deepEqual(listNames(backlogDir, "completed"), []);
    // Lock and temp state are cleaned on the failure path.
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")));
    assert.deepEqual(strays(backlogDir, "tasks"), []);
    assert.deepEqual(strays(backlogDir, "completed"), []);

    // Recovery: once the fault clears, a fresh close archives cleanly.
    const healthy = createLocalAdapter({ backlogDir, now: FIXED_NOW });
    healthy.close("BACK-1");
    assert.deepEqual(listNames(backlogDir, "tasks"), []);
    assert.deepEqual(listNames(backlogDir, "completed"), ["BACK-1 - one.md"]);
    assert.match(read(backlogDir, "completed", "BACK-1 - one.md"), /^status: Done$/m);
  });

  it("does not erase an externally replaced completed destination during rollback", (t) => {
    const { backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One", body: "\n## Description\nactive\n" })]],
    });
    const completedPath = path.join(backlogDir, "completed", "BACK-1 - one.md");
    const external = taskFile({ id: 1, title: "External owner", status: "Done", body: "\n## Description\nexternal\n" });
    const adapter = createLocalAdapter({
      backlogDir,
      now: FIXED_NOW,
      testHooks: {
        beforeUnlinkSource() {
          // Simulate another writer swapping our fresh publication for their own inode.
          fs.rmSync(completedPath);
          fs.writeFileSync(completedPath, external);
          throw new Error("injected source unlink failure");
        },
      },
    });
    assert.throws(() => adapter.close("BACK-1"), (error) => error instanceof LocalStoreError && /both/.test(error.message));

    // The externally owned destination is preserved byte-for-byte, and the active source survives.
    assert.equal(fs.readFileSync(completedPath, "utf-8"), external);
    assert.ok(fs.existsSync(path.join(backlogDir, "tasks", "BACK-1 - one.md")));
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")));
    assert.deepEqual(strays(backlogDir, "completed"), []);
  });

  it("preserves both copies and reports a split store when rollback also fails", (t) => {
    const { backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One", body: "\n## Description\nkeep\n" })]],
    });
    const adapter = createLocalAdapter({
      backlogDir,
      now: FIXED_NOW,
      testHooks: {
        beforeUnlinkSource() {
          throw new Error("injected source unlink failure");
        },
        beforeRollback() {
          throw new Error("injected rollback failure");
        },
      },
    });
    assert.throws(() => adapter.close("BACK-1"), (error) => error instanceof LocalStoreError && /both/.test(error.message));

    // No data loss: both the active source and the completed copy stay intact.
    assert.ok(fs.existsSync(path.join(backlogDir, "tasks", "BACK-1 - one.md")));
    assert.deepEqual(listNames(backlogDir, "completed"), ["BACK-1 - one.md"]);
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")));
    assert.deepEqual(strays(backlogDir, "completed"), []);

    // The store now fails closed on the duplicate id until an operator resolves it.
    const healthy = createLocalAdapter({ backlogDir, now: FIXED_NOW });
    assert.throws(() => healthy.read("BACK-1"), LocalStoreError);
    assert.throws(() => healthy.list({ state: "all" }), LocalStoreError);

    // Recovery: removing the duplicate completed copy restores a clean close.
    fs.rmSync(path.join(backlogDir, "completed", "BACK-1 - one.md"));
    healthy.close("BACK-1");
    assert.deepEqual(listNames(backlogDir, "tasks"), []);
    assert.deepEqual(listNames(backlogDir, "completed"), ["BACK-1 - one.md"]);
  });
});

describe("local required frontmatter validation", () => {
  const INVALID = {
    "missing id": "---\ntitle: One\nstatus: To Do\n---\n## Description\nx\n",
    "missing title": "---\nid: BACK-1\nstatus: To Do\n---\n## Description\nx\n",
    "missing status": "---\nid: BACK-1\ntitle: One\n---\n## Description\nx\n",
    "duplicate id": "---\nid: BACK-1\nid: BACK-1\ntitle: One\nstatus: To Do\n---\n## Description\nx\n",
    "wrong-type title": "---\nid: BACK-1\ntitle:\n  - a\n  - b\nstatus: To Do\n---\n## Description\nx\n",
    "empty status": "---\nid: BACK-1\ntitle: One\nstatus: ''\n---\n## Description\nx\n",
    "no frontmatter": "just a body, no frontmatter fence\n",
  };
  for (const [label, content] of Object.entries(INVALID)) {
    it(`rejects ${label} on read and list before returning a task`, (t) => {
      const { adapter } = makeStore(t, { seedTasks: [["BACK-1 - one.md", content]] });
      assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
      assert.throws(() => adapter.list(), LocalStoreError);
      assert.throws(() => adapter.list({ state: "all" }), LocalStoreError);
    });
  }

  it("requires the frontmatter id to equal the filename ref", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 2, title: "Mismatch" })]],
    });
    assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
    assert.throws(() => adapter.list(), LocalStoreError);
  });

  it("rejects invalid required frontmatter on update and close before mutating", (t) => {
    const missingStatus = "---\nid: BACK-1\ntitle: One\n---\n## Description\nx\n";
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", missingStatus]],
    });
    const before = read(backlogDir, "tasks", "BACK-1 - one.md");
    assert.throws(() => adapter.update("BACK-1", { status: "In Progress" }), LocalStoreError);
    assert.throws(() => adapter.close("BACK-1"), LocalStoreError);
    assert.equal(read(backlogDir, "tasks", "BACK-1 - one.md"), before, "no mutation touched bytes");
    assert.deepEqual(listNames(backlogDir, "completed"), []);
  });

  it("accepts a well-formed task the way create renders it", (t) => {
    const { adapter } = makeStore(t);
    adapter.create({ title: "Well formed", labels: ["a"], dependencies: ["BACK-9"] });
    assert.equal(adapter.read("BACK-1").title, "Well formed");
    assert.deepEqual(adapter.list().map((task) => task.ref), ["BACK-1"]);
  });
});

describe("local metadata injection is rejected fail-closed", () => {
  const CREATE_INJECTIONS = {
    status: "In Progress\ninjected: true",
    title: "Title\nid: BACK-999",
    priority: "high\nmalicious: 1",
  };
  for (const [field, value] of Object.entries(CREATE_INJECTIONS)) {
    it(`rejects a newline-injecting ${field} on create without writing`, (t) => {
      const { adapter, backlogDir } = makeStore(t);
      const input = { title: field === "title" ? value : "Safe", [field]: value };
      assert.throws(() => adapter.create(input), LocalStoreError);
      assert.deepEqual(listNames(backlogDir, "tasks"), []);
      assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")));
      assert.deepEqual(strays(backlogDir, "tasks"), []);
    });
  }

  it("rejects newline-injecting labels and dependencies on create", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    assert.throws(() => adapter.create({ title: "Safe", labels: ["ok", "bad\nid: BACK-999"] }), LocalStoreError);
    assert.throws(() => adapter.create({ title: "Safe", dependencies: ["BACK-2\ninjected: true"] }), LocalStoreError);
    assert.deepEqual(listNames(backlogDir, "tasks"), []);
  });

  it("also rejects carriage returns, NUL, and tabs in scalar metadata", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    for (const bad of ["A\rB", "A B", "A\tB"]) {
      assert.throws(() => adapter.create({ title: "Safe", status: bad }), LocalStoreError);
    }
    assert.throws(() => adapter.create({ title: "Tab\tinject" }), LocalStoreError);
    assert.deepEqual(listNames(backlogDir, "tasks"), []);
  });

  it("rejects injection on update and leaves bytes and mtime unchanged", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
    });
    const filePath = path.join(backlogDir, "tasks", "BACK-1 - one.md");
    const before = fs.readFileSync(filePath, "utf-8");
    const mtimeBefore = fs.statSync(filePath).mtimeMs;
    const injections = [
      { status: "Done\ninjected: true" },
      { title: "New\nid: BACK-9" },
      { priority: "high\nx: 1" },
      { labels: ["ok", "bad\nkey: v"] },
      { dependencies: ["BACK-2\nkey: v"] },
      { updated_date: "2026-07-11\ninjected: true" },
    ];
    for (const change of injections) {
      assert.throws(() => adapter.update("BACK-1", change), LocalStoreError);
    }
    assert.equal(fs.readFileSync(filePath, "utf-8"), before, "bytes unchanged");
    assert.equal(fs.statSync(filePath).mtimeMs, mtimeBefore, "mtime unchanged (no temp/mtime mutation)");
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")));
    assert.deepEqual(strays(backlogDir, "tasks"), []);
  });
});

describe("local update no-op and list-state validation edges", () => {
  it("treats update with no changes as a byte and mtime no-op", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
    });
    const filePath = path.join(backlogDir, "tasks", "BACK-1 - one.md");
    const before = fs.readFileSync(filePath, "utf-8");
    const mtimeBefore = fs.statSync(filePath).mtimeMs;
    const result = adapter.update("BACK-1", {});
    assert.deepEqual(result, { tracker: "local", id: "1", ref: "BACK-1" });
    assert.equal(fs.readFileSync(filePath, "utf-8"), before, "bytes unchanged");
    assert.equal(fs.statSync(filePath).mtimeMs, mtimeBefore, "mtime unchanged");
    assert.deepEqual(strays(backlogDir, "tasks"), []);
  });

  it("no-ops when every requested field already holds its current value", (t) => {
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One", status: "To Do" })]],
    });
    const filePath = path.join(backlogDir, "tasks", "BACK-1 - one.md");
    const before = fs.readFileSync(filePath, "utf-8");
    const mtimeBefore = fs.statSync(filePath).mtimeMs;
    adapter.update("BACK-1", { status: "To Do" });
    assert.equal(fs.readFileSync(filePath, "utf-8"), before, "value-preserving update keeps bytes");
    assert.equal(fs.statSync(filePath).mtimeMs, mtimeBefore, "value-preserving update keeps mtime");
  });

  it("rejects an invalid list state instead of silently defaulting to open", (t) => {
    const { adapter } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
      seedCompleted: [["BACK-5 - five.md", taskFile({ id: 5, title: "Five", status: "Done" })]],
    });
    for (const bad of ["opened", "OPEN", "active", "Open", "", null, 1, "toString", "__proto__"]) {
      assert.throws(() => adapter.list({ state: bad }), LocalStoreError);
    }
    assert.deepEqual(adapter.list({ state: "open" }).map((task) => task.ref), ["BACK-1"]);
    assert.deepEqual(adapter.list({ state: "closed" }).map((task) => task.ref), ["BACK-5"]);
    assert.deepEqual(adapter.list({ state: "all" }).map((task) => task.ref), ["BACK-1", "BACK-5"]);
    assert.deepEqual(adapter.list().map((task) => task.ref), ["BACK-1"]);
  });
});
