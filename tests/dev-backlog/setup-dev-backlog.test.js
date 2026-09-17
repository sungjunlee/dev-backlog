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
  it("accepts github and files and rejects retired or unknown authorities", () => {
    assert.equal(parseArgs(["--tracker", "github"]).tracker, "github");
    assert.equal(parseArgs(["--tracker", "files"]).tracker, "files");
    assert.throws(() => parseArgs(["--tracker", "local"]), /expected github or files/);
    assert.throws(() => parseArgs(["--tracker", "gitea"]), /expected github or files/);
  });

  it("creates only .tracker and sprints for a fresh files repository", async (t) => {
    const cwd = root(t, "setup-files-");
    const result = await runSetup({ cwd, tracker: "files", nonInteractive: true });
    assert.equal(result.selection, "files");
    assert.deepEqual(fs.readdirSync(path.join(cwd, ".dev-backlog")).sort(), [".tracker", "sprints"]);
    assert.equal(fs.readFileSync(path.join(cwd, ".dev-backlog/.tracker"), "utf8"), "files\n");
  });

  it("creates only .tracker and sprints for a fresh repository", async (t) => {
    const cwd = root(t);
    const result = await runSetup({ cwd, tracker: "github", nonInteractive: true });
    assert.equal(result.selection, "github");
    assert.deepEqual(fs.readdirSync(path.join(cwd, ".dev-backlog")).sort(), [".tracker", "sprints"]);
    assert.equal(fs.readFileSync(path.join(cwd, ".dev-backlog/.tracker"), "utf8"), "github\n");
  });

  it("preserves a legacy github config byte-for-byte while pinning .tracker", async (t) => {
    const cwd = root(t);
    const backlogDir = path.join(cwd, ".dev-backlog");
    fs.mkdirSync(backlogDir);
    const raw = "project_name: legacy\r\ntracker: github\r\n# keep\r\n";
    fs.writeFileSync(path.join(backlogDir, "config.yml"), raw);
    const result = await runSetup({ cwd, nonInteractive: true });
    assert.equal(result.selectionSource, "legacy-migration");
    assert.equal(fs.readFileSync(path.join(backlogDir, "config.yml"), "utf8"), raw);
    assert.equal(fs.readFileSync(path.join(backlogDir, ".tracker"), "utf8"), "github\n");
  });

  it("refuses retired local selections before effects", async (t) => {
    for (const source of ["config", "selection"]) {
      const cwd = root(t, `setup-retired-${source}-`);
      const backlogDir = path.join(cwd, ".dev-backlog");
      fs.mkdirSync(backlogDir);
      if (source === "config") {
        fs.writeFileSync(path.join(backlogDir, "config.yml"), "tracker: local\n");
      } else {
        fs.writeFileSync(path.join(backlogDir, ".tracker"), "local\n");
      }
      const before = snapshot(cwd);
    await assert.rejects(
      runSetup({ cwd, nonInteractive: true }),
      /expected github or files/,
    );
      assert.deepEqual(snapshot(cwd), before);
    }
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

  it("rejects unsafe .tracker publication paths", async (t) => {
    const cwd = root(t);
    const outside = root(t, "setup-outside-");
    fs.mkdirSync(path.join(cwd, ".dev-backlog"));
    try {
      fs.symlinkSync(path.join(outside, "selection"), path.join(cwd, ".dev-backlog/.tracker"));
    } catch (error) {
      if (process.platform === "win32" && error.code === "EPERM") {
        t.skip("Windows symlink privilege unavailable");
        return;
      }
      throw error;
    }
    const before = snapshot(cwd);
    await assert.rejects(
      runSetup({ cwd, tracker: "github", nonInteractive: true }),
      SetupError,
    );
    assert.deepEqual(snapshot(cwd), before);
  });

  it("migrates leftover skill files from backlog/ into .dev-backlog and leaves export paths", async (t) => {
    const cwd = root(t);
    const source = path.join(cwd, "backlog");
    fs.mkdirSync(path.join(source, "sprints"), { recursive: true });
    fs.mkdirSync(path.join(source, "tasks"));
    fs.writeFileSync(path.join(source, ".tracker"), "github\n");
    fs.writeFileSync(path.join(source, "config.yml"), "project_name: leftover\ntracker: github\n");
    fs.writeFileSync(path.join(source, "sprints", "keep.md"), "# keep\n");
    fs.writeFileSync(path.join(source, "tasks", "BACK-1.md"), "export\n");

    const result = await runSetup({ cwd, nonInteractive: true });
    assert.equal(result.selection, "github");
    assert.equal(fs.readFileSync(path.join(cwd, ".dev-backlog/.tracker"), "utf8"), "github\n");
    assert.equal(
      fs.readFileSync(path.join(cwd, ".dev-backlog/config.yml"), "utf8"),
      "project_name: leftover\ntracker: github\n",
    );
    assert.equal(fs.readFileSync(path.join(cwd, ".dev-backlog/sprints/keep.md"), "utf8"), "# keep\n");
    assert.equal(fs.existsSync(path.join(source, "sprints")), false);
    assert.equal(fs.existsSync(path.join(source, ".tracker")), false);
    assert.equal(fs.existsSync(path.join(source, "config.yml")), false);
    assert.equal(fs.readFileSync(path.join(source, "tasks", "BACK-1.md"), "utf8"), "export\n");
  });

  it("refuses leftover local tracker under backlog/ before migrating", async (t) => {
    const cwd = root(t);
    const source = path.join(cwd, "backlog");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, ".tracker"), "local\n");
    const before = snapshot(cwd);
    await assert.rejects(
      runSetup({ cwd, nonInteractive: true }),
      /expected github or files/,
    );
    assert.deepEqual(snapshot(cwd), before);
    assert.equal(fs.existsSync(path.join(cwd, ".dev-backlog")), false);
  });

  it("leaves a lone backlog/config.yml in place and pins .dev-backlog/.tracker", async (t) => {
    const cwd = root(t);
    const source = path.join(cwd, "backlog");
    const raw = "project_name: backlog-md\ndefault_status: To Do\n";
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "config.yml"), raw);
    const result = await runSetup({ cwd, tracker: "github", nonInteractive: true });
    assert.equal(result.selection, "github");
    assert.equal(fs.readFileSync(path.join(cwd, ".dev-backlog/.tracker"), "utf8"), "github\n");
    assert.equal(fs.existsSync(path.join(cwd, ".dev-backlog/config.yml")), false);
    assert.equal(fs.readFileSync(path.join(source, "config.yml"), "utf8"), raw);
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
