const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const { createLocalAdapter, LocalStoreError } = require("./local-tracker.js");
const { run: renderGithubMirrors } = require("./sync-pull.js");

const FIXED_DATE = "2026-07-26";
const FIXED_NOW = () => new Date(`${FIXED_DATE}T12:00:00Z`);
const STORE_FILE = "local-tracker.json";
const LOCAL_TRACKER_PATH = path.join(__dirname, "local-tracker.js");

function makeStore(t, config = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-tracker-"));
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(backlogDir, { recursive: true });
  fs.writeFileSync(
    path.join(backlogDir, "config.yml"),
    [
      "tracker: local",
      `task_prefix: "${config.task_prefix || "BACK"}"`,
      `default_status: "${config.default_status || "To Do"}"`,
      "",
    ].join("\n")
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return {
    root,
    backlogDir,
    adapter: createLocalAdapter({ backlogDir, now: FIXED_NOW, config }),
  };
}

function storePath(backlogDir) {
  return path.join(backlogDir, STORE_FILE);
}

function readStore(backlogDir) {
  return JSON.parse(fs.readFileSync(storePath(backlogDir), "utf8"));
}

function record(id, fields = {}) {
  return {
    id,
    title: fields.title || `Task ${id}`,
    status: fields.status || "To Do",
    labels: fields.labels || [],
    priority: fields.priority || "medium",
    dependencies: fields.dependencies || [],
    milestone: "",
    created_date: fields.created_date || FIXED_DATE,
    updated_date: fields.updated_date || FIXED_DATE,
    body: fields.body || `\n## Description\nTask ${id}\n`,
    state: fields.state || "open",
  };
}

function seedStore(backlogDir, tasks) {
  fs.writeFileSync(
    storePath(backlogDir),
    `${JSON.stringify({ version: 1, tasks }, null, 2)}\n`
  );
}

function mirrorNames(backlogDir, kind) {
  const dir = path.join(backlogDir, kind);
  return fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.endsWith(".md")).sort()
    : [];
}

function tempNames(backlogDir) {
  const names = [];
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.lstatSync(full);
      if (stat.isDirectory()) scan(full);
      else if (name.includes(".local-tracker.") && name.endsWith(".tmp")) names.push(full);
    }
  }
  scan(backlogDir);
  return names;
}

function symlinkSupported(root) {
  try {
    const target = path.join(root, ".symlink-target");
    const link = path.join(root, ".symlink-probe");
    fs.mkdirSync(target);
    fs.symlinkSync(target, link);
    fs.unlinkSync(link);
    fs.rmdirSync(target);
    return true;
  } catch {
    return false;
  }
}

describe("local JSON substrate contract", () => {
  it("exposes exactly seven operations, no optional capabilities, and a usable empty store", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    assert.deepEqual(Object.keys(adapter), [
      "availability",
      "capabilities",
      "list",
      "read",
      "create",
      "update",
      "close",
    ]);
    assert.deepEqual(adapter.capabilities(), []);
    assert.deepEqual(adapter.availability(), { available: true });
    assert.deepEqual(adapter.list(), []);
    assert.equal(fs.existsSync(storePath(backlogDir)), false, "reads do not create a store");
  });

  it("reads and writes only the JSON authority and overwrites hand-edited mirrors", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    adapter.create({ title: "Canonical", body: "Original body" });
    const mirror = path.join(backlogDir, "tasks", "BACK-1 - canonical.md");
    fs.writeFileSync(
      mirror,
      "---\nid: BACK-1\ntitle: Hand edited\nstatus: Done\n---\nforged mirror body\n"
    );

    assert.equal(adapter.read("BACK-1").title, "Canonical");
    assert.equal(adapter.read("BACK-1").status, "To Do");
    assert.match(adapter.read("BACK-1").body, /Original body/);

    adapter.update("BACK-1", { priority: "high" });
    const refreshed = fs.readFileSync(mirror, "utf8");
    assert.match(refreshed, /^title: Canonical$/m);
    assert.match(refreshed, /^status: To Do$/m);
    assert.match(refreshed, /Original body/);
    assert.doesNotMatch(refreshed, /Hand edited|forged mirror body/);
  });

  it("emits the exact GitHub mirror filename and byte shape", (t) => {
    const { root, adapter, backlogDir } = makeStore(t);
    const githubDir = path.join(root, "github-mirrors");
    fs.mkdirSync(githubDir);
    const today = new Date().toISOString().slice(0, 10);
    const local = createLocalAdapter({
      backlogDir,
      now: () => new Date(`${today}T12:00:00Z`),
    });
    local.create({
      id: "7",
      title: "Same mirror",
      body: "Human body\n\n## Acceptance Criteria\n- [ ] Same bytes",
      labels: ["feature"],
      priority: "high",
    });
    renderGithubMirrors({
      issues: [{
        number: 7,
        title: "Same mirror",
        body: "Human body\n\n## Acceptance Criteria\n- [ ] Same bytes",
        labels: [{ name: "feature" }, { name: "priority:high" }],
        milestone: null,
      }],
      tasksDir: githubDir,
      prefix: "BACK",
      update: false,
      dryRun: false,
    });
    const name = "BACK-7 - same-mirror.md";
    assert.equal(
      fs.readFileSync(path.join(backlogDir, "tasks", name), "utf8"),
      fs.readFileSync(path.join(githubDir, name), "utf8")
    );
    assert.deepEqual(adapter.list().map((task) => task.ref), ["BACK-7"]);
  });

  it("allocates exact ids across open and completed records without prefix collisions", (t) => {
    const { adapter } = makeStore(t);
    assert.equal(adapter.create({ id: "1", title: "One" }).id, "1");
    assert.equal(adapter.create({ id: "11", title: "Eleven" }).id, "11");
    adapter.close("BACK-11");
    assert.equal(adapter.create({ title: "Next" }).id, "12");
    assert.throws(
      () => adapter.create({ id: "11", title: "Completed collision" }),
      /BACK-11 already exists/
    );
  });

  it("supports decimal ids and allocates above parents beyond Number.MAX_SAFE_INTEGER", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    seedStore(backlogDir, [
      record("1.2"),
      record("9007199254740993", { state: "closed", status: "Done" }),
    ]);
    assert.deepEqual(adapter.read("BACK-1.2").dependencies, []);
    assert.equal(adapter.create({ title: "Large next" }).id, "9007199254740994");
    assert.throws(() => adapter.create({ id: "1.2", title: "Duplicate" }), /already exists/);
  });

  it("lists open, closed, and all tasks in numeric parent/subtask order", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    seedStore(backlogDir, [
      record("11"),
      record("2.3", { state: "closed", status: "Done" }),
      record("2"),
      record("2.1"),
    ]);
    assert.deepEqual(adapter.list().map((task) => task.id), ["2", "2.1", "11"]);
    assert.deepEqual(adapter.list({ state: "closed" }).map((task) => task.id), ["2.3"]);
    assert.deepEqual(adapter.list({ state: "all" }).map((task) => task.id), [
      "2",
      "2.1",
      "2.3",
      "11",
    ]);
    assert.throws(() => adapter.list({ state: "maybe" }), /expected one of open, closed, all/);
  });

  it("resolves identity, ref, and bare-id selectors without accepting a foreign prefix", (t) => {
    const { adapter } = makeStore(t);
    const identity = adapter.create({ id: "4.2", title: "Selectors" });
    assert.equal(adapter.read(identity).id, "4.2");
    assert.equal(adapter.read("BACK-4.2").id, "4.2");
    assert.equal(adapter.read("4.2").id, "4.2");
    assert.throws(() => adapter.read("OTHER-4.2"), /unresolved local task selector/);
    assert.throws(
      () => adapter.read({ tracker: "github", id: "4.2", ref: "#4" }),
      /requires a local task identity/
    );
  });

  it("updates only requested canonical fields, preserves body, and renames the mirror from title", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    adapter.create({
      title: "Before",
      body: "Body\n\n## Acceptance Criteria\n- [ ] Preserve",
      labels: ["one"],
      dependencies: ["BACK-9"],
    });
    const body = adapter.read("BACK-1").body;
    adapter.update("BACK-1", {
      title: "After",
      status: "In Progress",
      labels: ["two"],
      updated_date: "2026-07-27",
    });
    const updated = adapter.read("BACK-1");
    assert.equal(updated.body, body);
    assert.deepEqual(updated.dependencies, ["BACK-9"]);
    assert.equal(updated.updated_date, "2026-07-27");
    assert.deepEqual(mirrorNames(backlogDir, "tasks"), ["BACK-1 - after.md"]);
    assert.match(
      fs.readFileSync(path.join(backlogDir, "tasks", "BACK-1 - after.md"), "utf8"),
      /^status: In Progress$/m
    );
  });

  it("replaces a body only when supplied and keeps it canonical across mirror refreshes", (t) => {
    const { adapter } = makeStore(t);
    adapter.create({ title: "Body", body: "First" });
    const first = adapter.read("1").body;
    adapter.update("1", { priority: "low" });
    assert.equal(adapter.read("1").body, first);
    adapter.update("1", { body: "Second\n- [ ] AC" });
    assert.equal(adapter.read("1").body, "\n## Description\nSecond\n- [ ] AC\n");
  });

  it("closes in one canonical store commit and projects exactly one completed mirror", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    const identity = adapter.create({ title: "Archive", body: "Keep me" });
    assert.deepEqual(adapter.close(identity), identity);
    assert.deepEqual(adapter.close(identity), identity, "close is idempotent");
    assert.deepEqual(adapter.list(), []);
    assert.deepEqual(adapter.list({ state: "closed" }).map((task) => task.ref), ["BACK-1"]);
    assert.equal(adapter.read(identity).status, "Done");
    assert.deepEqual(mirrorNames(backlogDir, "tasks"), []);
    assert.deepEqual(mirrorNames(backlogDir, "completed"), ["BACK-1 - archive.md"]);
    assert.match(
      fs.readFileSync(path.join(backlogDir, "completed", "BACK-1 - archive.md"), "utf8"),
      /Keep me/
    );
    assert.equal(readStore(backlogDir).tasks.filter((task) => task.id === "1").length, 1);
  });

  it("rejects unsupported provider fields before any mutation", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    for (const invoke of [
      () => adapter.create({ title: "No", milestone: "v1" }),
      () => adapter.update("BACK-1", { assignees: ["me"] }),
      () => adapter.close("BACK-1", { reason: "merged" }),
    ]) {
      assert.throws(invoke, /reports no optional capabilities/);
    }
    assert.equal(fs.existsSync(storePath(backlogDir)), false);
  });
});

describe("fail-closed JSON and filesystem validation", () => {
  it("rejects control-character injection before create or update writes", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    const injections = [
      "title\nstatus: Done",
      "status\rpriority: high",
      `label${String.fromCharCode(0)}value`,
      "priority\tcritical",
    ];
    assert.throws(() => adapter.create({ title: injections[0] }), /control characters/);
    assert.throws(() => adapter.create({ title: "Safe", status: injections[1] }), /control characters/);
    assert.throws(() => adapter.create({ title: "Safe", labels: [injections[2]] }), /control characters/);
    assert.throws(() => adapter.create({ title: "Safe", priority: injections[3] }), /control characters/);
    assert.equal(fs.existsSync(storePath(backlogDir)), false);

    adapter.create({ title: "Safe" });
    const before = fs.readFileSync(storePath(backlogDir), "utf8");
    assert.throws(
      () => adapter.update("BACK-1", { status: "In Progress\nowner: attacker" }),
      /control characters/
    );
    assert.equal(fs.readFileSync(storePath(backlogDir), "utf8"), before);
  });

  it("fails availability and every read on malformed or duplicate JSON records", (t) => {
    const { backlogDir } = makeStore(t);
    for (const raw of [
      "{\"version\":1,\"tasks\":[",
      JSON.stringify({ version: 2, tasks: [] }),
      JSON.stringify({ version: 1, tasks: [record("1"), record("1")] }),
      JSON.stringify({ version: 1, tasks: [{ ...record("1"), state: "lost" }] }),
      JSON.stringify({ version: 1, tasks: [{ ...record("1"), title: "" }] }),
    ]) {
      fs.writeFileSync(storePath(backlogDir), raw);
      const adapter = createLocalAdapter({ backlogDir, now: FIXED_NOW });
      assert.equal(adapter.availability().available, false);
      assert.throws(() => adapter.list(), LocalStoreError);
    }
  });

  it("ignores stale and forged Markdown when the JSON store is absent", (t) => {
    const { adapter, backlogDir } = makeStore(t);
    fs.mkdirSync(path.join(backlogDir, "tasks"));
    fs.mkdirSync(path.join(backlogDir, "completed"));
    fs.writeFileSync(
      path.join(backlogDir, "tasks", "BACK-99 - forged.md"),
      "---\nid: BACK-99\ntitle: Forged\nstatus: Done\n---\n"
    );
    fs.writeFileSync(
      path.join(backlogDir, "completed", "BACK-100 - forged.md"),
      "---\nid: BACK-100\ntitle: Forged\nstatus: Done\n---\n"
    );
    assert.deepEqual(adapter.list({ state: "all" }), []);
    assert.throws(() => adapter.read("BACK-99"), /not found/);
    assert.equal(adapter.create({ title: "Canonical first" }).id, "1");
    assert.deepEqual(mirrorNames(backlogDir, "tasks"), ["BACK-1 - canonical-first.md"]);
    assert.deepEqual(mirrorNames(backlogDir, "completed"), []);
  });

  it("refuses symlinked canonical paths without following them", (t) => {
    const { root, backlogDir } = makeStore(t);
    if (!symlinkSupported(root)) return;
    const external = path.join(root, "external");
    fs.mkdirSync(external);
    const tasksDir = path.join(backlogDir, "tasks");
    fs.symlinkSync(external, tasksDir);
    const adapter = createLocalAdapter({ backlogDir, now: FIXED_NOW });
    assert.equal(adapter.availability().available, false);
    assert.throws(() => adapter.create({ title: "Escape" }), /must not be a symlink/);
    assert.deepEqual(fs.readdirSync(external), []);
  });

  it("refuses a symlinked or non-regular JSON authority", (t) => {
    const { root, backlogDir } = makeStore(t);
    if (!symlinkSupported(root)) return;
    const external = path.join(root, "outside.json");
    fs.writeFileSync(external, JSON.stringify({ version: 1, tasks: [] }));
    fs.symlinkSync(external, storePath(backlogDir));
    let adapter = createLocalAdapter({ backlogDir, now: FIXED_NOW });
    assert.equal(adapter.availability().available, false);
    assert.throws(() => adapter.list(), /must not be a symlink/);
    fs.unlinkSync(storePath(backlogDir));
    fs.mkdirSync(storePath(backlogDir));
    adapter = createLocalAdapter({ backlogDir, now: FIXED_NOW });
    assert.equal(adapter.availability().available, false);
    assert.throws(() => adapter.list(), /not a regular file/);
  });

  it("rejects unsafe prefixes before any path mutation", (t) => {
    for (const taskPrefix of ["../ESCAPE", "BAD/PREFIX", "BAD PREFIX", ""]) {
      const { backlogDir } = makeStore(t);
      const adapter = createLocalAdapter({
        backlogDir,
        now: FIXED_NOW,
        config: { task_prefix: taskPrefix, default_status: "To Do" },
      });
      assert.equal(adapter.availability().available, false);
      assert.throws(() => adapter.create({ title: "No escape" }), /task_prefix/);
      assert.equal(fs.existsSync(storePath(backlogDir)), false);
    }
  });
});

describe("atomic replacement and all-platform concurrency coverage", () => {
  it("removes a partial temp and preserves the complete old store when writing fails", (t) => {
    const { backlogDir } = makeStore(t);
    seedStore(backlogDir, [record("1")]);
    const before = fs.readFileSync(storePath(backlogDir), "utf8");
    const adapter = createLocalAdapter({
      backlogDir,
      now: FIXED_NOW,
      testHooks: {
        writeStoreTemp(tmp) {
          fs.writeFileSync(tmp, "{\"version\":1,\"tasks\":[");
          const error = new Error("disk full");
          error.code = "ENOSPC";
          throw error;
        },
      },
    });
    assert.throws(() => adapter.create({ title: "Never committed" }), /disk full/);
    assert.equal(fs.readFileSync(storePath(backlogDir), "utf8"), before);
    assert.deepEqual(tempNames(backlogDir), []);
  });

  it("a crash after close rename leaves one readable closed record and heals mirrors on retry", (t) => {
    const { backlogDir } = makeStore(t);
    const normal = createLocalAdapter({ backlogDir, now: FIXED_NOW });
    normal.create({ title: "Crash close", body: "Durable" });
    const crashing = createLocalAdapter({
      backlogDir,
      now: FIXED_NOW,
      testHooks: {
        afterStoreRename() {
          throw new Error("simulated process death after atomic rename");
        },
      },
    });
    assert.throws(() => crashing.close("BACK-1"), /simulated process death/);
    const stored = readStore(backlogDir);
    assert.equal(stored.tasks.length, 1);
    assert.equal(stored.tasks[0].state, "closed");
    assert.equal(stored.tasks[0].status, "Done");
    assert.equal(normal.read("BACK-1").state, "closed");

    normal.close("BACK-1");
    assert.deepEqual(mirrorNames(backlogDir, "tasks"), []);
    assert.deepEqual(mirrorNames(backlogDir, "completed"), ["BACK-1 - crash-close.md"]);
    assert.equal(fs.existsSync(path.join(backlogDir, ".local-tracker.lock")), false);
    assert.equal(fs.existsSync(path.join(backlogDir, ".local-tracker.close")), false);
  });

  it("concurrent writers and readers never expose torn JSON or leaked temp files", async (t) => {
    const { root, backlogDir } = makeStore(t);
    createLocalAdapter({ backlogDir, now: FIXED_NOW }).create({ title: "Shared" });
    const worker = path.join(root, "writer.js");
    fs.writeFileSync(
      worker,
      [
        `const { createLocalAdapter } = require(${JSON.stringify(LOCAL_TRACKER_PATH)});`,
        "const [backlogDir, label] = process.argv.slice(2);",
        "const adapter = createLocalAdapter({ backlogDir });",
        "for (let i = 0; i < 80; i += 1) {",
        "  adapter.update('BACK-1', { priority: i % 2 ? 'high' : 'low', labels: [label] });",
        "}",
      ].join("\n")
    );
    const children = ["alpha", "beta", "gamma"].map((label) =>
      spawn(process.execPath, [worker, backlogDir, label], {
        stdio: ["ignore", "ignore", "pipe"],
      })
    );
    let reads = 0;
    const errors = [];
    await new Promise((resolve, reject) => {
      const timer = setInterval(() => {
        try {
          const store = readStore(backlogDir);
          assert.equal(store.version, 1);
          assert.equal(store.tasks.length, 1);
          assert.equal(store.tasks[0].id, "1");
          reads += 1;
        } catch (error) {
          errors.push(error);
        }
      }, 1);
      let remaining = children.length;
      for (const child of children) {
        let stderr = "";
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
        child.on("error", reject);
        child.on("close", (code) => {
          if (code !== 0) errors.push(new Error(`writer exited ${code}: ${stderr}`));
          remaining -= 1;
          if (remaining === 0) {
            clearInterval(timer);
            resolve();
          }
        });
      }
    });
    assert.equal(errors.length, 0, errors.map((error) => error.message).join("\n"));
    assert.ok(reads > 0, "the canonical file was parsed while writers raced");
    const final = readStore(backlogDir);
    assert.equal(final.tasks.length, 1);
    assert.ok(["alpha", "beta", "gamma"].includes(final.tasks[0].labels[0]));
    assert.deepEqual(tempNames(backlogDir), []);
  });
});
