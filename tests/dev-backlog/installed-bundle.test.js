const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "../..");

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function childEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

describe("isolated supported skill bundle (#503)", () => {
  it("loads both skills, dry-runs triage without a provider, and executes every #498/#500 CLI migration", (t) => {
    const root = fs.mkdtempSync(path.join(REPO_ROOT, ".tmp-installed-bundle-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const installedRoot = path.join(root, "installed");
    const projectRoot = path.join(root, "project");
    fs.cpSync(path.join(REPO_ROOT, "skills"), path.join(installedRoot, "skills"), { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });

    const devScripts = path.join(installedRoot, "skills/dev-backlog/scripts");
    const triageApply = path.join(installedRoot, "skills/backlog-triage/scripts/triage-apply.js");
    const stateScript = path.join(devScripts, "sprint-state.js");
    const sprintPath = path.join(projectRoot, ".dev-backlog/sprints/2026-11-auth.md");
    write(projectRoot, ".dev-backlog/sprints/2026-11-auth.md", [
      "---", "status: active", "component: auth", "---", "", "# Auth", "",
      "## Goal", "Ship auth.", "", "## Plan", "- [x] #1 Done", "- [ ] #2 Next", "",
      "## Running Context", "", "## Progress", "- 2026-11-12: opened.", "",
    ].join("\n"));

    const runState = (...args) => spawnSync(process.execPath, [stateScript, ...args], {
      cwd: projectRoot,
      encoding: "utf8",
      env: childEnv(),
    });

    // #498: the three shell entry points are gone and their documented Node/edit replacements work.
    for (const retired of ["next.sh", "status.sh", "sprint-close.sh"]) {
      assert.equal(fs.existsSync(path.join(devScripts, retired)), false, retired);
    }
    const next = runState("--mode", "next", "--format", "text");
    assert.equal(next.status, 0, next.stderr);
    assert.match(next.stdout, /#2 Next/);
    const status = runState("--mode", "status", "--format", "text");
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /2026-11-auth/);

    const source = fs.readFileSync(sprintPath, "utf8");
    const readyToClose = source.replace("- [ ] #2 Next", "- [x] #2 Next");
    fs.writeFileSync(sprintPath, readyToClose
      .replace(/^status: active$/m, "status: completed")
      .replace(
        "## Progress\n- 2026-11-12: opened.\n",
        "## Progress\n- 2026-11-12: opened.\n- 2026-11-12: Sprint closed. 2/2 tasks completed.\n",
      ));
    const closed = runState("--mode", "status", "--format", "text");
    assert.equal(closed.status, 0, closed.stderr);
    assert.equal(closed.stdout, "=== Active Sprint ===\n(no active sprint)\n");

    // #500: the removed selector fails, while --track accepts the same component handle.
    fs.writeFileSync(sprintPath, source);
    const retiredComponent = runState("--mode", "status", "--component", "auth");
    assert.notEqual(retiredComponent.status, 0);
    assert.match(retiredComponent.stderr, /Unknown argument: --component/);
    const track = runState("--mode", "status", "--format", "text", "--track", "auth");
    assert.equal(track.status, 0, track.stderr);
    assert.match(track.stdout, /2026-11-auth/);

    // The supported installation unit is the whole skills bundle: triage imports dev-backlog siblings.
    write(projectRoot, "report.md", [
      "---", "generated: 2026-11-12", "---", "", "## Apply Checklist", "",
      "<!-- triage:revisit #21 reason=\"needs owner\" -->", "- [x] Accept", "",
    ].join("\n"));
    const providerLog = path.join(root, "provider-called");
    const binDir = path.join(root, "bin");
    write(root, "bin/gh", `#!/usr/bin/env node\nrequire("node:fs").writeFileSync(${JSON.stringify(providerLog)}, "gh\\n");\nprocess.exit(99);\n`);
    fs.chmodSync(path.join(binDir, "gh"), 0o755);
    const dryRun = spawnSync(process.execPath, [triageApply, "report.md"], {
      cwd: projectRoot,
      encoding: "utf8",
      env: childEnv({ PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}` }),
    });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.match(dryRun.stdout, /DRY-RUN/);
    assert.equal(fs.existsSync(providerLog), false, "triage dry-run must make zero provider calls");
  });
});
