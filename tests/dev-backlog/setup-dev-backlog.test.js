const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  SetupError,
  collectGithubEvidence,
  parseArgs,
  runSetup,
} = require(path.join(SKILL_SCRIPTS, "setup-dev-backlog.js"));
const {
  leftoverSkillFiles,
  migrateLegacyExecutionRoot,
} = require(path.join(SKILL_SCRIPTS, "execution-root.js"));

function root(t, prefix = "setup-github-only-") {
  const value = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

function snapshot(directory) {
  const result = {};
  function walk(current, relative = "") {
    if (!fs.existsSync(current)) return;
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const key = path.join(relative, name);
      const stat = fs.lstatSync(full);
      result[key] = {
        type: stat.isDirectory() ? "directory" : stat.isSymbolicLink() ? "symlink" : "file",
        bytes: stat.isFile() ? fs.readFileSync(full, "base64") : null,
      };
      if (stat.isDirectory()) walk(full, key);
    }
  }
  walk(directory);
  return result;
}

describe("GitHub-only setup", () => {
  it("accepts any --tracker value and never pins one (#445)", () => {
    for (const value of ["github", "files", "local", "gitea"]) {
      assert.equal(parseArgs(["--tracker", value]).tracker, value);
    }
    assert.throws(() => parseArgs(["--tracker"]), SetupError);
  });

  it("creates only sprints/ for a fresh repository and writes no .tracker", async (t) => {
    const cwd = root(t);
    const result = await runSetup({ cwd, nonInteractive: true });
    assert.deepEqual(result.createdDirectories, ["sprints"]);
    assert.deepEqual(fs.readdirSync(path.join(cwd, ".dev-backlog")).sort(), ["sprints"]);
    assert.equal(fs.existsSync(path.join(cwd, ".dev-backlog/.tracker")), false);
    assert.ok(!("selection" in result));
  });

  it("ignores a leftover .tracker and never rewrites config.yml", async (t) => {
    const cwd = root(t);
    const backlogDir = path.join(cwd, ".dev-backlog");
    fs.mkdirSync(backlogDir);
    const raw = "project_name: legacy\r\ntracker: files\r\n# keep\r\n";
    fs.writeFileSync(path.join(backlogDir, "config.yml"), raw);
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "files\n");

    await runSetup({ cwd, nonInteractive: true });

    assert.equal(fs.readFileSync(path.join(backlogDir, "config.yml"), "utf8"), raw);
    assert.equal(fs.readFileSync(path.join(backlogDir, ".tracker"), "utf8"), "files\n");
    assert.equal(fs.existsSync(path.join(backlogDir, "sprints")), true);
  });

  it("never recommends a runtime fallback when GitHub evidence is unavailable", () => {
    const evidence = collectGithubEvidence({
      cwd: "/repo",
      execFileSync(command) {
        const error = new Error(`${command} unavailable`);
        error.code = "ENOENT";
        throw error;
      },
    });
    assert.equal(evidence.recommendation, "github");
    assert.equal(evidence.auth, "not-checked");
  });

  it("refuses an unsafe backlog root before any effect", async (t) => {
    const cwd = root(t);
    const outside = root(t, "setup-outside-");
    try {
      fs.symlinkSync(outside, path.join(cwd, ".dev-backlog"));
    } catch (error) {
      if (process.platform === "win32" && error.code === "EPERM") {
        t.skip("Windows symlink privilege unavailable");
        return;
      }
      throw error;
    }
    const before = snapshot(cwd);
    await assert.rejects(runSetup({ cwd, nonInteractive: true }), SetupError);
    assert.deepEqual(snapshot(cwd), before);
  });

  it("migrates leftover skill files from backlog/ and leaves export paths", async (t) => {
    const cwd = root(t);
    const source = path.join(cwd, "backlog");
    fs.mkdirSync(path.join(source, "sprints"), { recursive: true });
    fs.mkdirSync(path.join(source, "tasks"));
    fs.writeFileSync(path.join(source, "config.yml"), "project_name: leftover\n");
    fs.writeFileSync(path.join(source, "sprints", "keep.md"), "# keep\n");
    fs.writeFileSync(path.join(source, "tasks", "one.md"), "export\n");

    await runSetup({ cwd, nonInteractive: true });

    assert.equal(
      fs.readFileSync(path.join(cwd, ".dev-backlog/config.yml"), "utf8"),
      "project_name: leftover\n",
    );
    assert.equal(fs.readFileSync(path.join(cwd, ".dev-backlog/sprints/keep.md"), "utf8"), "# keep\n");
    assert.equal(fs.existsSync(path.join(source, "sprints")), false);
    assert.equal(fs.existsSync(path.join(source, "config.yml")), false);
    assert.equal(fs.readFileSync(path.join(source, "tasks", "one.md"), "utf8"), "export\n");
  });

  it("leaves a lone backlog/config.yml and a parked backlog/.tracker in place", async (t) => {
    const cwd = root(t);
    const source = path.join(cwd, "backlog");
    const raw = "project_name: backlog-md\ndefault_status: To Do\n";
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "config.yml"), raw);
    fs.writeFileSync(path.join(source, ".tracker"), "files\n");

    await runSetup({ cwd, nonInteractive: true });

    assert.equal(fs.existsSync(path.join(cwd, ".dev-backlog/config.yml")), false);
    assert.equal(fs.readFileSync(path.join(source, "config.yml"), "utf8"), raw);
    assert.equal(fs.readFileSync(path.join(source, ".tracker"), "utf8"), "files\n");
    assert.deepEqual(leftoverSkillFiles(cwd), []);
  });

  it("skips auto-migrate when .dev-backlog/ already exists", (t) => {
    const cwd = root(t);
    fs.mkdirSync(path.join(cwd, ".dev-backlog"));
    fs.mkdirSync(path.join(cwd, "backlog", "sprints"), { recursive: true });
    fs.writeFileSync(path.join(cwd, "backlog", "sprints", "keep.md"), "# leftover\n");
    const result = migrateLegacyExecutionRoot(cwd);
    assert.equal(result.migrated, false);
    assert.equal(result.reason, "destination-exists");
    assert.equal(fs.readFileSync(path.join(cwd, "backlog", "sprints", "keep.md"), "utf8"), "# leftover\n");
    assert.deepEqual(leftoverSkillFiles(cwd), ["sprints"]);
  });
});
