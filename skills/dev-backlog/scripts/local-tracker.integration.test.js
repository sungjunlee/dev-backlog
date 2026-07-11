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

/** Install a `gh` that records any invocation and fails, proving no-gh paths. */
function installFailingGh(t, root) {
  const binDir = path.join(root, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  const marker = path.join(root, "gh-invoked");
  fs.writeFileSync(
    path.join(binDir, "gh"),
    `#!/bin/sh\necho "gh $*" >> "${marker}"\nexit 97\n`
  );
  fs.chmodSync(path.join(binDir, "gh"), 0o755);
  const savedPath = process.env.PATH;
  process.env.PATH = `${binDir}:${savedPath}`;
  t.after(() => {
    process.env.PATH = savedPath;
  });
  return { binDir, marker, envPath: `${binDir}:${savedPath}` };
}

function localAdapter(backlogDir) {
  return resolveConfiguredTracker({ tracker: "local" }, { backlogDir });
}

describe("offline local core sprint cycle", () => {
  it("runs create → Plan → status/next → read → work-state update → close/archive with no gh", (t) => {
    const { root, backlogDir } = makeOfflineStore(t);
    const { marker, envPath } = installFailingGh(t, root);
    const { adapter } = localAdapter(backlogDir);

    // create three canonical local tasks, offline
    const first = adapter.create({ title: "Design offline adapter" });
    const second = adapter.create({ title: "Prove core cycle" });
    const third = adapter.create({ title: "Archive on close" });
    assert.deepEqual([first, second, third].map((task) => task.ref), ["BACK-1", "BACK-2", "BACK-3"]);
    assert.equal([first, second, third].every((task) => !("url" in task)), true);

    // Plan them into an active sprint using their normalized refs
    fs.writeFileSync(
      path.join(backlogDir, "sprints", "cycle.md"),
      [
        "---", "milestone: local cycle", "status: active", "started: 2026-07-11", "---", "",
        "# Offline Local Cycle", "",
        "## Goal", "Prove the offline local core cycle.", "",
        "## Plan", "",
        "### Batch 1 - core",
        `- [ ] ${first.ref} Design offline adapter`,
        `- [ ] ${second.ref} Prove core cycle`,
        `- [ ] ${third.ref} Archive on close`,
        "", "## Running Context", "", "## Progress", "",
      ].join("\n")
    );

    // status orientation: the active sprint reads back normalized local plan items
    const state = readSprintState({ backlogDir });
    assert.equal(state.active_sprint.frontmatter.milestone, "local cycle");
    assert.deepEqual(state.plan_items.map((item) => item.ref), ["BACK-1", "BACK-2", "BACK-3"]);
    assert.equal(state.plan_items.every((item) => item.tracker === "local" && item.issue_number === null), true);

    // next orientation: the first todo batch is the local batch we planned
    const nextBatch = findNextBatch(state.plan_items);
    assert.equal(nextBatch.heading, "### Batch 1 - core");
    assert.deepEqual(nextBatch.items.map((item) => item.ref), ["BACK-1", "BACK-2", "BACK-3"]);

    // the whole orientation path is gh-free when driven as a subprocess
    const oriented = spawnSync(process.execPath, [
      path.join(SCRIPTS_DIR, "sprint-state.js"), "--mode", "next", backlogDir, "--json",
    ], { encoding: "utf8", env: { ...process.env, PATH: envPath } });
    assert.equal(oriented.status, 0);
    const orientedState = JSON.parse(oriented.stdout);
    assert.deepEqual(orientedState.plan_items.map((item) => item.ref), ["BACK-1", "BACK-2", "BACK-3"]);

    // read one task by its normalized ref
    const readBack = adapter.read(second.ref);
    assert.equal(readBack.title, "Prove core cycle");
    assert.equal(readBack.status, "To Do");
    assert.equal(readBack.state, "open");

    // work-state update preserves the human body byte-for-byte
    const secondFile = path.join(backlogDir, "tasks", "BACK-2 - prove-core-cycle.md");
    const bodyBefore = fs.readFileSync(secondFile, "utf-8");
    const humanBody = bodyBefore.slice(bodyBefore.indexOf("\n## Description"));
    adapter.update(second.ref, { status: "In Progress" });
    const bodyAfter = fs.readFileSync(secondFile, "utf-8");
    assert.equal(bodyAfter.slice(bodyAfter.indexOf("\n## Description")), humanBody);
    assert.match(bodyAfter, /^status: In Progress$/m);

    // checked close archives exactly that task into completed/ as Done
    adapter.close(second.ref);
    assert.equal(fs.existsSync(secondFile), false);
    const archived = fs.readFileSync(path.join(backlogDir, "completed", "BACK-2 - prove-core-cycle.md"), "utf-8");
    assert.match(archived, /^status: Done$/m);
    assert.deepEqual(adapter.list().map((task) => task.ref), ["BACK-1", "BACK-3"]);
    assert.deepEqual(adapter.list({ state: "closed" }).map((task) => task.ref), ["BACK-2"]);

    // the entire cycle never touched gh
    assert.equal(fs.existsSync(marker), false, `gh must never run offline; invocations: ${fs.existsSync(marker) ? fs.readFileSync(marker, "utf-8") : ""}`);
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
        (error) => {
          assert.equal(error.tracker, "local");
          assert.equal(error.capability, capability);
          return true;
        }
      );
      assert.equal(mutated, false);
    }
  });

  it("handles malformed input, exact collisions, and decimal identities", (t) => {
    const { backlogDir } = makeOfflineStore(t);
    const { adapter } = localAdapter(backlogDir);

    assert.throws(() => adapter.create({ title: "" }), LocalStoreError);
    assert.throws(() => adapter.create({}), LocalStoreError);

    // seed a BACK-1/BACK-11 collision boundary directly
    for (const [id, name] of [[1, "one"], [11, "eleven"]]) {
      fs.writeFileSync(
        path.join(backlogDir, "tasks", `BACK-${id} - ${name}.md`),
        `---\nid: BACK-${id}\ntitle: ${name}\nstatus: To Do\nlabels: []\npriority: medium\ncreated_date: '2026-07-01'\n---\n## Description\n${name}\n`
      );
    }
    assert.equal(adapter.read("BACK-1").id, "1");
    assert.equal(adapter.read("BACK-11").id, "11");
    assert.equal(adapter.create({ title: "next parent" }).id, "12");

    const sub = adapter.create({ title: "decimal child", id: "1.2" });
    assert.deepEqual(sub, { tracker: "local", id: "1.2", ref: "BACK-1.2" });
    assert.throws(() => adapter.create({ title: "dup decimal", id: "1.2" }), LocalStoreError);
  });
});

describe("offline concurrent allocation is atomic", () => {
  it("assigns distinct ids to parallel allocators with no overwrite or leaked lock/temp", async (t) => {
    const { root, backlogDir } = makeOfflineStore(t);
    const workerPath = path.join(root, "alloc-worker.js");
    fs.writeFileSync(
      workerPath,
      `const { createLocalAdapter } = require(${JSON.stringify(LOCAL_TRACKER_PATH)});\n` +
        "const [backlogDir, title] = process.argv.slice(2);\n" +
        "try {\n" +
        "  const id = createLocalAdapter({ backlogDir }).create({ title });\n" +
        "  process.stdout.write(JSON.stringify(id));\n" +
        "  process.exit(0);\n" +
        "} catch (error) {\n" +
        "  process.stderr.write(String(error && error.message));\n" +
        "  process.exit(3);\n" +
        "}\n"
    );

    const WORKERS = 8;
    const results = await Promise.all(
      Array.from({ length: WORKERS }, (_unused, index) =>
        new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [workerPath, backlogDir, `Parallel task ${index}`], {
            stdio: ["ignore", "pipe", "pipe"],
          });
          let out = "";
          let err = "";
          child.stdout.on("data", (chunk) => { out += chunk; });
          child.stderr.on("data", (chunk) => { err += chunk; });
          child.on("close", (code) => {
            if (code === 0) resolve(JSON.parse(out));
            else reject(new Error(`worker ${index} exited ${code}: ${err}`));
          });
        })
      )
    );

    const ids = results.map((identity) => Number(identity.id)).sort((a, b) => a - b);
    assert.deepEqual(ids, Array.from({ length: WORKERS }, (_unused, index) => index + 1), "ids must be distinct 1..N");

    const files = fs.readdirSync(path.join(backlogDir, "tasks")).filter((name) => name.endsWith(".md"));
    assert.equal(files.length, WORKERS, "one file per allocation, none overwritten");
    assert.equal(new Set(files.map((name) => name.split(" - ")[0])).size, WORKERS);

    // no leaked lock or temp files remain
    assert.equal(fs.existsSync(path.join(backlogDir, ".local-tracker.lock")), false);
    const strays = fs.readdirSync(path.join(backlogDir, "tasks")).filter((name) => name.includes(".tmp"));
    assert.deepEqual(strays, []);
  });
});
