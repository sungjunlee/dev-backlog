const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const { resolveConfiguredTracker, invokeCapability, CAPABILITY_NAMES } = require("./tracker.js");
const { LocalStoreError } = require("./local-tracker.js");
const { readSprintState, findNextBatch } = require("./sprint-state.js");

const SCRIPTS_DIR = __dirname;
const LOCAL_TRACKER_PATH = path.join(SCRIPTS_DIR, "local-tracker.js");

function makeOfflineStore(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-integration-"));
  const backlogDir = path.join(root, "backlog");
  fs.mkdirSync(path.join(backlogDir, "tasks"), { recursive: true });
  fs.mkdirSync(path.join(backlogDir, "completed"), { recursive: true });
  fs.mkdirSync(path.join(backlogDir, "sprints"), { recursive: true });
  fs.writeFileSync(
    path.join(backlogDir, "config.yml"),
    'tracker: local\ntask_prefix: "BACK"\ndefault_status: "To Do"\nstatuses: ["To Do", "In Progress", "Done"]\n'
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, backlogDir };
}

function installFailingGh(t, root) {
  const binDir = path.join(root, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const marker = path.join(root, "gh-invoked");
  fs.writeFileSync(
    path.join(binDir, "gh"),
    `#!/bin/sh\necho "gh $*" >> "${marker}"\nexit 97\n`
  );
  fs.chmodSync(path.join(binDir, "gh"), 0o755);
  const envPath = `${binDir}:${process.env.PATH}`;
  return { marker, envPath };
}

function localAdapter(backlogDir) {
  return resolveConfiguredTracker({ tracker: "local" }, { backlogDir });
}

function canonical(backlogDir) {
  return JSON.parse(fs.readFileSync(path.join(backlogDir, "local-tracker.json"), "utf8"));
}

function strays(backlogDir) {
  const result = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.lstatSync(full);
      if (stat.isDirectory()) walk(full);
      else if (name.endsWith(".tmp") || name === ".local-tracker.lock" || name === ".local-tracker.close") {
        result.push(full);
      }
    }
  }
  walk(backlogDir);
  return result;
}

describe("offline local core sprint cycle", () => {
  it("runs create → Plan → status/next → read → work-state update → close/archive with no gh", (t) => {
    const { root, backlogDir } = makeOfflineStore(t);
    const { marker, envPath } = installFailingGh(t, root);
    const { adapter } = localAdapter(backlogDir);

    const first = adapter.create({ title: "Design offline adapter" });
    const second = adapter.create({
      title: "Prove core cycle",
      body: "Human body\n\n## Acceptance Criteria\n- [ ] Keep this AC",
    });
    const third = adapter.create({ title: "Archive on close" });
    assert.deepEqual([first, second, third].map((task) => task.ref), [
      "BACK-1",
      "BACK-2",
      "BACK-3",
    ]);
    assert.equal([first, second, third].every((task) => !("url" in task)), true);

    fs.writeFileSync(
      path.join(backlogDir, "sprints", "cycle.md"),
      [
        "---", "milestone: local cycle", "status: active", "started: 2026-07-11", "---", "",
        "# Offline Local Cycle", "", "## Goal", "Prove the offline local core cycle.", "",
        "## Plan", "", "### Batch 1 - core",
        `- [ ] ${first.ref} Design offline adapter`,
        `- [ ] ${second.ref} Prove core cycle`,
        `- [ ] ${third.ref} Archive on close`,
        "", "## Running Context", "", "## Progress", "",
      ].join("\n")
    );

    const state = readSprintState({ backlogDir });
    assert.equal(state.active_sprint.frontmatter.milestone, "local cycle");
    assert.deepEqual(state.plan_items.map((item) => item.ref), ["BACK-1", "BACK-2", "BACK-3"]);
    assert.equal(
      state.plan_items.every((item) => item.tracker === "local" && item.issue_number === null),
      true
    );
    assert.deepEqual(findNextBatch(state.plan_items).items.map((item) => item.ref), [
      "BACK-1",
      "BACK-2",
      "BACK-3",
    ]);

    const oriented = spawnSync(
      process.execPath,
      [path.join(SCRIPTS_DIR, "sprint-state.js"), "--mode", "next", backlogDir, "--json"],
      { encoding: "utf8", env: { ...process.env, PATH: envPath } }
    );
    assert.equal(oriented.status, 0);
    assert.deepEqual(JSON.parse(oriented.stdout).plan_items.map((item) => item.ref), [
      "BACK-1",
      "BACK-2",
      "BACK-3",
    ]);

    const body = adapter.read(second).body;
    adapter.update(second, { status: "In Progress" });
    assert.equal(adapter.read(second).body, body);
    assert.match(
      fs.readFileSync(path.join(backlogDir, "tasks", "BACK-2 - prove-core-cycle.md"), "utf8"),
      /^status: In Progress$/m
    );

    adapter.close(second);
    assert.deepEqual(adapter.list().map((task) => task.ref), ["BACK-1", "BACK-3"]);
    assert.deepEqual(adapter.list({ state: "closed" }).map((task) => task.ref), ["BACK-2"]);
    assert.match(
      fs.readFileSync(path.join(backlogDir, "completed", "BACK-2 - prove-core-cycle.md"), "utf8"),
      /Keep this AC/
    );
    assert.equal(canonical(backlogDir).tasks.length, 3);
    assert.equal(fs.existsSync(marker), false);
  });

  it("fails every optional capability before mutation and never falls back", (t) => {
    const { backlogDir } = makeOfflineStore(t);
    const resolved = localAdapter(backlogDir);
    assert.deepEqual(resolved.adapter.capabilities(), []);
    for (const capability of CAPABILITY_NAMES) {
      let mutated = false;
      assert.throws(
        () => invokeCapability(resolved, capability, () => {
          mutated = true;
        }),
        (error) => error.tracker === "local" && error.capability === capability
      );
      assert.equal(mutated, false);
    }
  });

  it("handles malformed input, exact active/completed collisions, and decimal identities", (t) => {
    const { backlogDir } = makeOfflineStore(t);
    const { adapter } = localAdapter(backlogDir);
    assert.throws(() => adapter.create({ title: "" }), LocalStoreError);
    assert.throws(() => adapter.create({}), LocalStoreError);

    assert.equal(adapter.create({ id: "1", title: "One" }).id, "1");
    assert.equal(adapter.create({ id: "11", title: "Eleven" }).id, "11");
    adapter.close("BACK-11");
    assert.equal(adapter.create({ title: "Next parent" }).id, "12");
    const sub = adapter.create({ title: "Decimal child", id: "1.2" });
    assert.deepEqual(sub, { tracker: "local", id: "1.2", ref: "BACK-1.2" });
    assert.throws(() => adapter.create({ title: "Dup completed", id: "11" }), /already exists/);
    assert.throws(() => adapter.create({ title: "Dup decimal", id: "1.2" }), /already exists/);
  });
});

describe("offline local close crash recovery", () => {
  it("keeps one canonical task when the process dies after atomic rename and heals mirrors", (t) => {
    const { root, backlogDir } = makeOfflineStore(t);
    const { adapter } = localAdapter(backlogDir);
    adapter.create({ title: "One", body: "Keep me" });

    const worker = path.join(root, "crash-worker.js");
    fs.writeFileSync(
      worker,
      [
        `const { createLocalAdapter } = require(${JSON.stringify(LOCAL_TRACKER_PATH)});`,
        "const [backlogDir] = process.argv.slice(2);",
        "const adapter = createLocalAdapter({",
        "  backlogDir,",
        "  testHooks: { afterStoreRename() { process.exit(99); } },",
        "});",
        "adapter.close('BACK-1');",
      ].join("\n")
    );
    const crashed = spawnSync(process.execPath, [worker, backlogDir], { encoding: "utf8" });
    assert.equal(crashed.status, 99);

    const stored = canonical(backlogDir);
    assert.equal(stored.tasks.length, 1);
    assert.equal(stored.tasks[0].id, "1");
    assert.equal(stored.tasks[0].state, "closed");
    assert.equal(stored.tasks[0].status, "Done");
    assert.equal(adapter.read("BACK-1").state, "closed");

    adapter.close("BACK-1");
    assert.deepEqual(fs.readdirSync(path.join(backlogDir, "tasks")), []);
    assert.deepEqual(fs.readdirSync(path.join(backlogDir, "completed")), ["BACK-1 - one.md"]);
    assert.match(
      fs.readFileSync(path.join(backlogDir, "completed", "BACK-1 - one.md"), "utf8"),
      /Keep me/
    );
    assert.deepEqual(strays(backlogDir), []);
  });
});

describe("offline concurrent replacement is atomic", () => {
  it("parallel writers leave a parseable single-record store with no lock or temp artifact", async (t) => {
    const { root, backlogDir } = makeOfflineStore(t);
    localAdapter(backlogDir).adapter.create({ title: "Shared" });
    const worker = path.join(root, "update-worker.js");
    fs.writeFileSync(
      worker,
      [
        `const { createLocalAdapter } = require(${JSON.stringify(LOCAL_TRACKER_PATH)});`,
        "const [backlogDir, label] = process.argv.slice(2);",
        "const adapter = createLocalAdapter({ backlogDir });",
        "for (let i = 0; i < 50; i += 1) {",
        "  adapter.update('BACK-1', { labels: [label], priority: i % 2 ? 'high' : 'low' });",
        "}",
      ].join("\n")
    );

    const children = ["one", "two", "three", "four"].map((label) =>
      spawn(process.execPath, [worker, backlogDir, label], {
        stdio: ["ignore", "ignore", "pipe"],
      })
    );
    const failures = [];
    await Promise.all(children.map((child) => new Promise((resolve, reject) => {
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) failures.push(`exit ${code}: ${stderr}`);
        resolve();
      });
    })));

    assert.deepEqual(failures, []);
    const stored = canonical(backlogDir);
    assert.equal(stored.version, 1);
    assert.equal(stored.tasks.length, 1);
    assert.equal(stored.tasks[0].id, "1");
    assert.ok(["one", "two", "three", "four"].includes(stored.tasks[0].labels[0]));
    assert.deepEqual(strays(backlogDir), []);
  });
});
