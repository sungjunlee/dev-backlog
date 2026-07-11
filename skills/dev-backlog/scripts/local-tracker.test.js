const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

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

describe("local CRLF task files parse and preserve their newline style", () => {
  const crlf = (id, status = "To Do") =>
    [
      "---",
      `id: BACK-${id}`,
      "title: Windows Task",
      `status: ${status}`,
      "labels:",
      "  - infra",
      "priority: medium",
      "created_date: '2026-07-01'",
      "---",
      "## Description",
      "line one",
      "line two",
      "",
    ].join("\r\n");

  const noBareLf = (content) => !/[^\r]\n/.test(content);

  it("reads a valid CRLF file instead of treating id as missing", (t) => {
    const { adapter } = makeStore(t, { seedTasks: [["BACK-1 - one.md", crlf(1)]] });
    const task = adapter.read("BACK-1");
    assert.equal(task.id, "1");
    assert.equal(task.title, "Windows Task");
    assert.equal(task.status, "To Do");
    assert.deepEqual(task.labels, ["infra"]);
    assert.deepEqual(adapter.list().map((x) => x.ref), ["BACK-1"]);
  });

  it("keeps CRLF newlines when updating a field", (t) => {
    const { adapter, backlogDir } = makeStore(t, { seedTasks: [["BACK-1 - one.md", crlf(1)]] });
    const before = read(backlogDir, "tasks", "BACK-1 - one.md");
    adapter.update("BACK-1", { status: "In Progress" });
    const after = read(backlogDir, "tasks", "BACK-1 - one.md");
    // Exactly the status line changed; every other byte, including CRLF, is intact.
    assert.equal(after, before.replace("status: To Do", "status: In Progress"));
    assert.ok(after.includes("\r\n"), "CRLF endings survive the update");
    assert.ok(noBareLf(after), "no bare LF was introduced");
  });

  it("keeps CRLF newlines when closing", (t) => {
    const { adapter, backlogDir } = makeStore(t, { seedTasks: [["BACK-1 - one.md", crlf(1)]] });
    const before = read(backlogDir, "tasks", "BACK-1 - one.md");
    adapter.close("BACK-1");
    const archived = read(backlogDir, "completed", "BACK-1 - one.md");
    assert.equal(archived, before.replace("status: To Do", "status: Done"));
    assert.ok(archived.includes("\r\n"));
    assert.ok(noBareLf(archived), "no bare LF was introduced on close");
  });
});

describe("local list items encode losslessly", () => {
  it("round-trips YAML-significant label and dependency items", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    const labels = ["#bug", "a: b", "true", "false", "[x]", "{a}", " leading", "trailing ", "quote's", "123"];
    const dependencies = ["- dash", "@handle", "key: val", "BACK-9"];
    adapter.create({ title: "Encoded", labels, dependencies });

    const task = adapter.read("BACK-1");
    assert.deepEqual(task.labels, labels);
    assert.deepEqual(task.dependencies, dependencies);

    // Survives a metadata-only update and a re-read of both read and list.
    adapter.update("BACK-1", { priority: "high" });
    assert.deepEqual(adapter.read("BACK-1").labels, labels);
    assert.deepEqual(adapter.list()[0].dependencies, dependencies);

    // YAML-significant items are quoted so meaning cannot change; a plain token stays bare.
    const raw = read(backlogDir, "tasks", "BACK-1 - encoded.md");
    assert.match(raw, /^ {2}- '#bug'$/m);
    assert.match(raw, /^ {2}- 'a: b'$/m);
    assert.match(raw, /^ {2}- 'true'$/m);
    assert.match(raw, /^ {2}- '123'$/m);
    assert.match(raw, /^ {2}- 'quote''s'$/m);
    assert.match(raw, /^ {2}- BACK-9$/m);
  });
});

describe("local allocation is precision-safe for large parent ids", () => {
  it("allocates strictly above a parent id beyond Number.MAX_SAFE_INTEGER", (t) => {
    const big = "9007199254740993"; // 2^53 + 1: rounds down when handled as a JS float
    const { adapter, backlogDir } = makeStore(t, {
      seedTasks: [[`BACK-${big} - big.md`, taskFile({ id: big, title: "Big" })]],
    });
    const created = adapter.create({ title: "Next" });
    assert.equal(created.id, "9007199254740994");
    assert.notEqual(created.id, "9007199254740992"); // the rounded-down (colliding) value
    assert.ok(fs.existsSync(path.join(backlogDir, "tasks", "BACK-9007199254740994 - next.md")));
    assert.equal(adapter.read(`BACK-${big}`).id, big);
    assert.equal(adapter.read("BACK-9007199254740994").id, "9007199254740994");
  });
});

describe("local publication cleans partial temp files when the write itself fails", () => {
  function failingWrite(tmp) {
    fs.writeFileSync(tmp, "partial bytes"); // a partial temp lands on disk...
    const error = new Error("ENOSPC: no space left on device, write");
    error.code = "ENOSPC";
    throw error; // ...then the write itself is reported as failed
  }

  it("removes the stray temp on create when the write fails", (t) => {
    const { backlogDir } = makeStore(t);
    const adapter = createLocalAdapter({ backlogDir, now: FIXED_NOW, testHooks: { writeFile: failingWrite } });
    assert.throws(() => adapter.create({ title: "Boom" }));
    assert.deepEqual(listNames(backlogDir, "tasks"), []);
    assert.deepEqual(strays(backlogDir, "tasks"), []);
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")));
  });

  it("removes the stray temp on update when the write fails and preserves the task", (t) => {
    const { backlogDir } = makeStore(t, { seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]] });
    const before = read(backlogDir, "tasks", "BACK-1 - one.md");
    const adapter = createLocalAdapter({ backlogDir, now: FIXED_NOW, testHooks: { writeFile: failingWrite } });
    assert.throws(() => adapter.update("BACK-1", { status: "In Progress" }));
    assert.equal(read(backlogDir, "tasks", "BACK-1 - one.md"), before, "original bytes untouched");
    assert.deepEqual(strays(backlogDir, "tasks"), []);
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")));
  });
});

const CLOSE_MARKER = ".local-tracker.close";

function symlinkSupported(root) {
  try {
    const link = path.join(root, ".symlink-probe");
    fs.symlinkSync(path.join(root, ".symlink-target"), link);
    fs.unlinkSync(link);
    return true;
  } catch {
    return false;
  }
}

describe("local rejects symlinked canonical paths", () => {
  it("refuses a symlinked task file on read, list, and close without following it", (t) => {
    const { root, backlogDir, adapter } = makeStore(t);
    if (!symlinkSupported(root)) return; // platform without symlink privileges
    // A real, well-formed task living OUTSIDE the backlog. A symlink in tasks/
    // would let read/close follow it and touch bytes beyond the canonical store.
    const outside = path.join(root, "outside.md");
    fs.writeFileSync(outside, taskFile({ id: 1, title: "Outside", body: "\n## Description\nsecret\n" }));
    fs.symlinkSync(outside, path.join(backlogDir, "tasks", "BACK-1 - one.md"));

    assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
    assert.throws(() => adapter.list(), LocalStoreError);
    assert.throws(() => adapter.close("BACK-1"), LocalStoreError);
    assert.ok(fs.existsSync(outside), "the symlink target outside the backlog is never touched");
  });

  it("reports unavailable for a symlinked canonical directory", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-tracker-symdir-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    if (!symlinkSupported(root)) return;
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(backlogDir, { recursive: true });
    fs.mkdirSync(path.join(backlogDir, "completed"), { recursive: true });
    const elsewhere = path.join(root, "elsewhere");
    fs.mkdirSync(elsewhere, { recursive: true });
    fs.symlinkSync(elsewhere, path.join(backlogDir, "tasks")); // tasks/ is a symlink
    const report = createLocalAdapter({ backlogDir, now: FIXED_NOW }).availability();
    assert.equal(report.available, false);
    assert.match(report.reason, /symlink/);
  });
});

describe("local recovery treats the close journal as untrusted", () => {
  function writeMarker(backlogDir, marker) {
    fs.writeFileSync(path.join(backlogDir, CLOSE_MARKER), JSON.stringify(marker));
  }

  it("keeps list and read non-mutating when a stale marker is present", (t) => {
    const { backlogDir, adapter } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One" })]],
    });
    writeMarker(backlogDir, { v: 1, phase: "publish", id: "1", ref: "BACK-1", file: "BACK-1 - one.md", destHash: "0".repeat(64) });
    assert.equal(adapter.read("BACK-1").id, "1");
    assert.equal(adapter.list().length, 1);
    assert.ok(fs.existsSync(path.join(backlogDir, CLOSE_MARKER)), "read/list never delete the marker");
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")), "read/list never take the lock");
  });

  it("does not promote an unverified external destination or delete the active source", (t) => {
    const { backlogDir, adapter } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", taskFile({ id: 1, title: "One", body: "\n## Description\nauthoritative\n" })]],
      seedCompleted: [["BACK-1 - one.md", taskFile({ id: 1, title: "External", status: "Done", body: "\n## Description\nexternal\n" })]],
    });
    const activeBefore = read(backlogDir, "tasks", "BACK-1 - one.md");
    const externalBefore = read(backlogDir, "completed", "BACK-1 - one.md");
    // Intent recorded, but the destination bytes never matched our publication.
    writeMarker(backlogDir, { v: 1, phase: "publish", id: "1", ref: "BACK-1", file: "BACK-1 - one.md", destHash: "0".repeat(64) });

    adapter.create({ title: "trigger recovery" }); // any mutation runs recover() first

    assert.equal(read(backlogDir, "tasks", "BACK-1 - one.md"), activeBefore, "authoritative active source is retained");
    assert.equal(read(backlogDir, "completed", "BACK-1 - one.md"), externalBefore, "the external destination is never promoted or altered");
    assert.ok(!fs.existsSync(path.join(backlogDir, CLOSE_MARKER)), "the untrusted marker is discarded");
  });

  it("fails closed on a marker whose filename escapes the canonical store", (t) => {
    const { root, backlogDir, adapter } = makeStore(t);
    const victim = path.join(root, "victim.md");
    fs.writeFileSync(victim, "do not delete me");
    writeMarker(backlogDir, { v: 1, phase: "publish", id: "1", ref: "BACK-1", file: "../../victim.md", destHash: "0".repeat(64) });

    adapter.create({ title: "trigger recovery" });

    assert.ok(fs.existsSync(victim), "a traversal filename never reaches an unlink");
    assert.ok(!fs.existsSync(path.join(backlogDir, CLOSE_MARKER)), "the malformed marker is cleared");
  });

  it("ignores a legacy absolute-path marker without deleting its targets", (t) => {
    const { root, backlogDir, adapter } = makeStore(t);
    const victim = path.join(root, "victim.md");
    fs.writeFileSync(victim, "arbitrary file the old marker pointed at");
    // The round-6 marker shape carried arbitrary absolute src/dest strings.
    writeMarker(backlogDir, { src: victim, dest: victim });

    adapter.create({ title: "trigger recovery" });

    assert.ok(fs.existsSync(victim), "an untyped legacy marker cannot drive an arbitrary unlink");
    assert.ok(!fs.existsSync(path.join(backlogDir, CLOSE_MARKER)), "the legacy marker is cleared");
  });

  it("refuses roll-forward when a self-consistent marker names a different authoritative body", (t) => {
    // Active source authoritative bytes (body X). A crash-safe close of THESE
    // bytes would publish Done(X); anything else is not this source's publication.
    const activeBytes =
      "---\nid: BACK-1\ntitle: One\nstatus: To Do\nlabels: []\npriority: medium\ncreated_date: '2026-07-01'\n---\n## Description\nauthoritative alpha\n";
    // A valid, self-consistent Done publication for the SAME ref BACK-1, but
    // derived from a DIFFERENT body (Y). The marker below names its real hash, so
    // marker and destination agree with each other — the trap the old code fell
    // into, deleting the active source because it trusted marker.destHash alone.
    const unrelatedDone =
      "---\nid: BACK-1\ntitle: One\nstatus: Done\nlabels: []\npriority: medium\ncreated_date: '2026-07-01'\n---\n## Description\nunrelated beta\n";
    const { backlogDir, adapter } = makeStore(t, {
      seedTasks: [["BACK-1 - one.md", activeBytes]],
      seedCompleted: [["BACK-1 - one.md", unrelatedDone]],
    });
    writeMarker(backlogDir, {
      v: 1,
      phase: "publish",
      id: "1",
      ref: "BACK-1",
      file: "BACK-1 - one.md",
      destHash: crypto.createHash("sha256").update(unrelatedDone, "utf-8").digest("hex"),
    });

    // Recovery derives Done(activeBytes) independently, sees it differ from both
    // the marker and the destination, and refuses to roll forward. The close then
    // fails closed on the surviving duplicate id.
    assert.throws(() => adapter.close("BACK-1"), LocalStoreError);

    // The authoritative active source is never deleted; the completed copy and the
    // marker are handled without touching either file's bytes.
    assert.equal(read(backlogDir, "tasks", "BACK-1 - one.md"), activeBytes, "authoritative active source preserved");
    assert.equal(read(backlogDir, "completed", "BACK-1 - one.md"), unrelatedDone, "completed copy never altered");
    assert.ok(!fs.existsSync(path.join(backlogDir, CLOSE_MARKER)), "the untrusted marker is discarded");

    // Every read path continues to fail closed on the duplicate until an operator resolves it.
    assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
    assert.throws(() => adapter.list({ state: "all" }), LocalStoreError);
  });
});

describe("local enforces canonical directory integrity at every lifecycle op", () => {
  const LOCAL_CONFIG = { task_prefix: "BACK", default_status: "To Do" };

  function names(dir) {
    return fs.readdirSync(dir).sort();
  }

  it("refuses every op when tasks/ is a symlink and never touches the target", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-tracker-symtasks-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    if (!symlinkSupported(root)) return;
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(path.join(backlogDir, "completed"), { recursive: true });
    const outside = path.join(root, "outside");
    fs.mkdirSync(outside, { recursive: true });
    const outsideTask = taskFile({ id: 1, title: "Outside" });
    fs.writeFileSync(path.join(outside, "BACK-1 - one.md"), outsideTask);
    fs.symlinkSync(outside, path.join(backlogDir, "tasks")); // tasks/ -> outside
    const before = names(outside);
    const adapter = createLocalAdapter({ backlogDir, config: LOCAL_CONFIG, now: FIXED_NOW });

    assert.throws(() => adapter.list(), LocalStoreError);
    assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
    assert.throws(() => adapter.create({ title: "Nope" }), LocalStoreError);
    assert.throws(() => adapter.update("BACK-1", { status: "Done" }), LocalStoreError);
    assert.throws(() => adapter.close("BACK-1"), LocalStoreError);

    assert.deepEqual(names(outside), before, "no file created/read outside the store");
    assert.equal(fs.readFileSync(path.join(outside, "BACK-1 - one.md"), "utf-8"), outsideTask, "the external task is never followed or rewritten");
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")), "no lock is taken through the symlink");
  });

  it("refuses every op when completed/ is a symlink and never touches the target", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-tracker-symdone-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    if (!symlinkSupported(root)) return;
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(path.join(backlogDir, "tasks"), { recursive: true });
    const activeBytes = taskFile({ id: 1, title: "One" });
    fs.writeFileSync(path.join(backlogDir, "tasks", "BACK-1 - one.md"), activeBytes);
    const outside = path.join(root, "outside");
    fs.mkdirSync(outside, { recursive: true });
    fs.symlinkSync(outside, path.join(backlogDir, "completed")); // completed/ -> outside
    const adapter = createLocalAdapter({ backlogDir, config: LOCAL_CONFIG, now: FIXED_NOW });

    assert.throws(() => adapter.list(), LocalStoreError);
    assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
    assert.throws(() => adapter.create({ title: "Nope" }), LocalStoreError);
    assert.throws(() => adapter.update("BACK-1", { status: "Done" }), LocalStoreError);
    assert.throws(() => adapter.close("BACK-1"), LocalStoreError);

    assert.deepEqual(names(outside), [], "close never publishes into the symlinked completed target");
    assert.equal(fs.readFileSync(path.join(backlogDir, "tasks", "BACK-1 - one.md"), "utf-8"), activeBytes, "the active source is untouched");
    assert.ok(!fs.existsSync(path.join(backlogDir, ".local-tracker.lock")), "no lock is left behind");
  });

  it("refuses every op when the backlog root is a symlink and never touches the target", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-tracker-symroot-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    if (!symlinkSupported(root)) return;
    const realStore = path.join(root, "real-store");
    fs.mkdirSync(path.join(realStore, "tasks"), { recursive: true });
    fs.mkdirSync(path.join(realStore, "completed"), { recursive: true });
    fs.writeFileSync(path.join(realStore, "tasks", "BACK-1 - one.md"), taskFile({ id: 1, title: "One" }));
    const backlogDir = path.join(root, "backlog");
    fs.symlinkSync(realStore, backlogDir); // the configured root is itself a symlink
    const adapter = createLocalAdapter({ backlogDir, config: LOCAL_CONFIG, now: FIXED_NOW });

    assert.equal(adapter.availability().available, false, "a symlinked root reports unavailable");
    assert.throws(() => adapter.list(), LocalStoreError);
    assert.throws(() => adapter.read("BACK-1"), LocalStoreError);
    assert.throws(() => adapter.create({ title: "Nope" }), LocalStoreError);
    assert.throws(() => adapter.update("BACK-1", { status: "Done" }), LocalStoreError);
    assert.throws(() => adapter.close("BACK-1"), LocalStoreError);

    assert.deepEqual(names(path.join(realStore, "tasks")), ["BACK-1 - one.md"], "no task created through the symlinked root");
    assert.deepEqual(names(path.join(realStore, "completed")), [], "close never archived through the symlinked root");
    assert.ok(!fs.existsSync(path.join(realStore, ".local-tracker.lock")), "no lock created through the symlinked root");
  });
});

describe("local allocation lock is never auto-reclaimed and release is identity-bound", () => {
  function findDeadPid() {
    for (const candidate of [999001, 999002, 999003, 4194303, 4194301]) {
      try {
        process.kill(candidate, 0);
      } catch (error) {
        if (error.code === "ESRCH") return candidate;
      }
    }
    throw new Error("could not find a provably-dead pid for the test");
  }

  it("preserves a replacement lock installed between the critical section and release", (t) => {
    const { backlogDir } = makeStore(t);
    const lockPath = path.join(backlogDir, ".local-tracker.lock");
    let replacementBytes = null;
    const adapter = createLocalAdapter({
      backlogDir,
      now: FIXED_NOW,
      testHooks: {
        beforeReleaseLock(lp) {
          // A replacement owner takes the lock after our critical section but
          // before our release. Reuse OUR exact stamp bytes (same pid:token) yet
          // give it a brand-new inode: token binding alone would still delete it,
          // so only the file-identity binding protects the replacement holder.
          replacementBytes = fs.readFileSync(lp, "utf-8");
          fs.rmSync(lp);
          fs.writeFileSync(lp, replacementBytes);
        },
      },
    });

    // The critical section itself completes, but release sees the file identity at
    // the path no longer matches the instance we opened and fails clearly instead
    // of unlinking a lock that is no longer ours.
    assert.throws(
      () => adapter.create({ title: "Raced" }),
      (error) => error instanceof LocalStoreError && /changed owner|replacement/i.test(error.message)
    );
    assert.deepEqual(listNames(backlogDir, "tasks"), ["BACK-1 - raced.md"], "the critical section still ran; only release refused");
    assert.ok(fs.existsSync(lockPath), "the replacement lock is not evicted even though its token matches");
    assert.equal(fs.readFileSync(lockPath, "utf-8"), replacementBytes, "the replacement holder's lock is byte-for-byte untouched");
  });

  it("never reclaims a dead-PID lock: two contenders both fail closed and the lock is untouched", (t) => {
    const { backlogDir } = makeStore(t);
    const lockPath = path.join(backlogDir, ".local-tracker.lock");
    const staleBytes = `${findDeadPid()}:stale-token`;
    fs.writeFileSync(lockPath, staleBytes);

    const contenders = [0, 1].map(() =>
      createLocalAdapter({ backlogDir, now: FIXED_NOW, lock: { retries: 1, delayMs: 1 } })
    );
    for (const contender of contenders) {
      assert.throws(
        () => contender.create({ title: "Blocked by stale" }),
        (error) => error instanceof LocalStoreError && /stale lock|no longer running|manually/i.test(error.message)
      );
    }

    // Neither contender reclaimed or deleted the stale lock, and neither entered
    // the critical section — so no concurrent critical sections could occur.
    assert.equal(fs.readFileSync(lockPath, "utf-8"), staleBytes, "the stale lock is never reclaimed or deleted");
    assert.deepEqual(listNames(backlogDir, "tasks"), [], "no contender entered the critical section");
  });
});

function snapshotTree(root) {
  const out = {};
  const walk = (rel) => {
    const abs = rel === "" ? root : path.join(root, rel);
    const st = fs.lstatSync(abs, { bigint: true });
    const type = st.isDirectory()
      ? "dir"
      : st.isSymbolicLink()
        ? "symlink"
        : st.isFile()
          ? "file"
          : "other";
    const rec = { type, size: st.size, mtimeNs: st.mtimeNs, ino: st.ino };
    if (type === "file") rec.content = fs.readFileSync(abs).toString("hex");
    if (type === "symlink") rec.target = fs.readlinkSync(abs);
    out[rel === "" ? "." : rel] = rec;
    if (type === "dir") {
      for (const name of fs.readdirSync(abs).sort()) {
        walk(rel === "" ? name : path.join(rel, name));
      }
    }
  };
  walk("");
  return out;
}

describe("local read paths never mutate the store (deep recursive before/after snapshot)", () => {
  function seedRecoveryStore(t) {
    const store = makeStore(t, {
      seedTasks: [
        ["BACK-1 - one.md", taskFile({ id: 1, title: "One" })],
        // Malformed: a valid filename whose content fails validation (missing status).
        ["BACK-2 - bad.md", "---\nid: BACK-2\ntitle: Two\n---\n## Description\nno status\n"],
        // A stray temp left by a prior crash — reads must not sweep it.
        [".local-tracker.99.2.deadbeef.tmp", "partial temp bytes"],
      ],
      seedCompleted: [["BACK-3 - three.md", taskFile({ id: 3, title: "Three", status: "Done" })]],
    });
    // Stale recovery metadata: a durable but stale close marker.
    fs.writeFileSync(
      path.join(store.backlogDir, CLOSE_MARKER),
      JSON.stringify({ v: 1, phase: "publish", id: "1", ref: "BACK-1", file: "BACK-1 - one.md", destHash: "0".repeat(64) })
    );
    return store;
  }

  it("list() over valid + malformed + stale-marker state mutates nothing and takes no lock", (t) => {
    const { backlogDir, adapter } = seedRecoveryStore(t);
    const before = snapshotTree(backlogDir);
    // A malformed task makes list fail closed — but it must still not mutate.
    assert.throws(() => adapter.list({ state: "all" }), LocalStoreError);
    const after = snapshotTree(backlogDir);
    assert.deepEqual(after, before, "list() preserves every name, type, content, size, mtime, and inode");
    assert.ok(!Object.prototype.hasOwnProperty.call(after, ".local-tracker.lock"), "list() never creates a lock");
    assert.ok(Object.prototype.hasOwnProperty.call(after, CLOSE_MARKER), "list() never touches the recovery marker");
  });

  it("read() of valid, closed, and malformed tasks mutates nothing and takes no lock", (t) => {
    const { backlogDir, adapter } = seedRecoveryStore(t);
    const before = snapshotTree(backlogDir);
    assert.equal(adapter.read("BACK-1").id, "1"); // valid open task
    assert.equal(adapter.read("BACK-3").state, "closed"); // valid closed task
    assert.throws(() => adapter.read("BACK-2"), LocalStoreError); // malformed content
    const after = snapshotTree(backlogDir);
    assert.deepEqual(after, before, "read() preserves every name, type, content, size, mtime, and inode");
    assert.ok(!Object.prototype.hasOwnProperty.call(after, ".local-tracker.lock"), "read() never creates a lock");
    assert.ok(Object.prototype.hasOwnProperty.call(after, CLOSE_MARKER), "read() never mutates recovery artifacts");
  });
});
