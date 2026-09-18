const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const { checkSprintShape } = require(path.join(SKILL_SCRIPTS, "backlog-doctor.js"));
const {
  parseArgs,
  buildComponentFrontmatterLine,
  buildSprintContent,
  listActiveSprintFiles,
  createSprintFile,
} = require(path.join(SKILL_SCRIPTS, "sprint-init.js"));

describe("parseArgs", () => {
  it("parses topic and milestone", () => {
    const parsed = parseArgs(["auth-system", "--milestone", "Sprint W13"]);
    assert.deepEqual(parsed, {
      topic: "auth-system",
      milestone: "Sprint W13",
    });
  });

  it("defaults milestone to topic", () => {
    const parsed = parseArgs(["auth-system"]);
    assert.equal(parsed.topic, "auth-system");
    assert.equal(parsed.milestone, "auth-system");
  });

  it("returns usage error when topic is missing", () => {
    const parsed = parseArgs([]);
    assert.match(parsed.error, /Usage: sprint-init\.js/);
  });

  it("returns usage error when only --milestone is provided without a topic", () => {
    const parsed = parseArgs(["--milestone", "Sprint W13"]);
    assert.match(parsed.error, /Usage: sprint-init\.js/);
  });

  it("parses --scope into a glob list, splitting on commas (#292)", () => {
    const parsed = parseArgs(["auth", "--scope", "src/auth/**, src/authz/**"]);
    assert.deepEqual(parsed.scope, ["src/auth/**", "src/authz/**"]);
  });

  it("omits the scope key entirely when --scope is not passed (#292)", () => {
    assert.ok(!("scope" in parseArgs(["auth"])));
  });

  it("rejects --scope without a value (#292)", () => {
    assert.match(parseArgs(["auth", "--scope"]).error, /Missing value for --scope/);
    assert.match(parseArgs(["auth", "--scope", "--milestone"]).error, /Missing value for --scope/);
  });

  it("parses --component as an explicit track axis (#331)", () => {
    const parsed = parseArgs(["auth", "--component", "sprint-execution"]);
    assert.equal(parsed.component, "sprint-execution");
    assert.ok(!("scope" in parsed));
  });

  it("rejects --component without a value or together with --scope (#331)", () => {
    assert.match(parseArgs(["auth", "--component"]).error, /Missing value for --component/);
    assert.match(
      parseArgs(["auth", "--component", "sprint-execution", "--scope", "src/**"]).error,
      /cannot be used together/,
    );
  });
});

describe("buildSprintContent", () => {
  it("renders sprint markdown with an empty Plan and no spec-axis frontmatter", () => {
    const content = buildSprintContent({
      milestone: "Sprint W13",
      started: "2026-04-05",
      due: "TBD",
      topic: "auth-system",
    });

    assert.match(content, /^---\n/);
    assert.match(content, /milestone: Sprint W13/);
    assert.match(content, /started: 2026-04-05/);
    assert.match(content, /due: TBD\n---/);
    assert.match(content, /# auth-system/);
    assert.match(content, /^## Plan$/m);
    assert.doesNotMatch(content, /^- \[ \]/m);
  });

  it("omits both spec fields when none were requested (B3, #426)", () => {
    const content = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "cold",
    });
    assert.match(content, /due: TBD\n---/);
    assert.doesNotMatch(content, /^objectives:/m);
    assert.doesNotMatch(content, /^component:/m);
  });

  it("emits a scope: line only when explicitly requested (D2, #292)", () => {
    const scoped = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "t",
      scope: ["src/auth/**", "src/authz/**"],
    });
    assert.match(scoped, /^scope: \["src\/auth\/\*\*", "src\/authz\/\*\*"\]$/m);
    assert.match(scoped, /due: TBD\nscope: \["src\/auth\/\*\*", "src\/authz\/\*\*"\]\n---/);

    const unscoped = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "t",
    });
    assert.doesNotMatch(unscoped, /^scope:/m);
  });

  it("never emits objectives:, whatever spec/ holds (#426)", () => {
    const content = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "t",
      component: "anything-goes",
    });
    assert.doesNotMatch(content, /^objectives:/m);
    assert.match(content, /^component: "anything-goes"$/m);
  });

  it("emits the requested component verbatim; it is a free string (#331, #426)", () => {
    const content = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "t",
      component: "sprint-execution",
    });
    assert.match(content, /^component: "sprint-execution"$/m);
    assert.doesNotMatch(content, /^component: ""$/m);
  });
});

describe("buildComponentFrontmatterLine", () => {
  it("returns empty string when no component was requested", () => {
    assert.equal(buildComponentFrontmatterLine(undefined), "");
    assert.equal(buildComponentFrontmatterLine(""), "");
  });
  it("returns one trailing-newline-terminated line when a component was requested", () => {
    assert.equal(buildComponentFrontmatterLine("sprint-execution"), 'component: "sprint-execution"\n');
  });
});

describe("createSprintFile", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sprint-init-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes sprint file and returns structured result", () => {
    const result = createSprintFile({
      topic: "auth-system",
      milestone: "Sprint W13",
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });

    assert.equal(result.action, "sprint-init");
    assert.equal(result.created, true);
    assert.equal(result.existingFile, false);
    assert.ok(!("component" in result));
    assert.equal(result.sprintFile, path.join(tmpDir, "2026-04-auth-system.md"));

    const written = fs.readFileSync(result.sprintFile, "utf-8");
    assert.equal(written, result.content);
    assert.match(written, /due: TBD\n---/);
    assert.match(written, /^## Plan$/m);
    assert.doesNotMatch(written, /^- \[ \]/m);
  });

  it("handles special characters in the topic (filename is slugified, title kept)", () => {
    const result = createSprintFile({
      topic: "OAuth2 / PKCE (v2)",
      milestone: "Sprint W15",
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });
    assert.ok(fs.existsSync(result.sprintFile));
    assert.match(path.basename(result.sprintFile), /^2026-04-.*\.md$/);
    assert.doesNotMatch(path.basename(result.sprintFile), /[\/()]/);
    assert.match(result.content, /OAuth2 \/ PKCE \(v2\)|oauth2/i);
  });

  it("never reads GitHub: no milestone seeding since #445", () => {
    const result = createSprintFile({
      topic: "no-network",
      milestone: "Sprint W16",
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });

    assert.equal(result.due, "TBD");
    assert.match(result.content, /^milestone: Sprint W16$/m);
  });

  it("generates sprint files that pass the doctor shape check (#339)", () => {
    for (const topic of ["empty", "milestone"]) {
      const repoRoot = path.join(tmpDir, topic);
      const backlogPath = path.join(repoRoot, ".dev-backlog");
      const result = createSprintFile({
        topic,
        milestone: topic,
        repoRoot,
        sprintsDir: path.join(backlogPath, "sprints"),
      });
      const shape = checkSprintShape({
        repoRoot,
        backlogPath,
        activePath: result.sprintFile,
        activeStatus: "pass",
      });

      assert.equal(shape.status, "pass", shape.detail.summary);
    }
  });

  it("omits spec fields in the written file when none were requested (B3, #426)", () => {
    const result = createSprintFile({
      topic: "cold-adopter",
      milestone: "M",
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });

    const written = fs.readFileSync(result.sprintFile, "utf-8");
    assert.match(written, /due: TBD\n---/);
    assert.doesNotMatch(written, /^objectives:/m);
    assert.doesNotMatch(written, /^component:/m);
  });

  it("accepts any --component string with no spec/ present and reads nothing there (#426)", () => {
    const sprintsDir = path.join(tmpDir, ".dev-backlog", "sprints");
    const readPaths = [];
    const result = createSprintFile({
      topic: "no-axis",
      milestone: "M",
      component: "not-a-declared-capability",
      sprintsDir,
      today: new Date("2026-04-05T09:00:00Z"),
      fileExists: (candidate) => {
        readPaths.push(candidate);
        return fs.existsSync(candidate);
      },
    });

    assert.equal(result.created, true);
    assert.equal(result.component, "not-a-declared-capability");
    assert.match(result.content, /^component: "not-a-declared-capability"$/m);
    assert.equal(readPaths.some((candidate) => candidate.includes(`${path.sep}spec${path.sep}`)), false);
  });

  it("refuses direct component + scope input before effects (#331)", () => {
    const sprintsDir = path.join(tmpDir, ".dev-backlog", "sprints");
    assert.throws(() => createSprintFile({
      topic: "two-axes",
      milestone: "M",
      component: "sprint-execution",
      scope: ["src/**"],
      sprintsDir,
      repoRoot: tmpDir,
    }), /cannot be used together/);
    assert.equal(fs.existsSync(sprintsDir), false);
  });

  it("lists active sprint files sorted and excludes _context.md", () => {
    fs.writeFileSync(path.join(tmpDir, "2026-04-beta.md"), "---\nstatus: active\n---\n");
    fs.writeFileSync(path.join(tmpDir, "2026-04-alpha.md"), "---\nstatus: active\n---\n");
    fs.writeFileSync(path.join(tmpDir, "2026-04-done.md"), "---\nstatus: completed\n---\n");
    fs.writeFileSync(path.join(tmpDir, "_context.md"), "status: active\n");

    assert.deepEqual(listActiveSprintFiles(tmpDir), [
      "2026-04-alpha.md",
      "2026-04-beta.md",
    ]);
  });

  it("refuses when the new sprint scope overlaps an active track (#292)", () => {
    fs.writeFileSync(
      path.join(tmpDir, "2026-04-current.md"),
      '---\nstatus: active\nscope: ["src/auth/**"]\n---\n',
    );

    assert.throws(() => {
      createSprintFile({
        topic: "next-sprint",
        milestone: "Sprint W14",
        scope: ["src/auth/api/**"],
        sprintsDir: tmpDir,
        today: new Date("2026-04-05T09:00:00Z"),
      });
    }, /Active track overlaps on scope: 2026-04-current\.md/);
  });

  it("refuses when a shared component: overlaps, regardless of scope globs (#292)", () => {
    fs.writeFileSync(
      path.join(tmpDir, "2026-04-current.md"),
      '---\nstatus: active\ncomponent: "auth-system"\n---\n',
    );

    // A scopeless new sprint next to a component-scoped track cannot be proven
    // to overlap — but two tracks on the SAME component axis can, via frontmatter.
    const disjoint = createSprintFile({
      topic: "billing",
      milestone: "Sprint W14",
      scope: ["src/billing/**"],
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });
    assert.deepEqual(disjoint.warnings, []);
  });

  it("refuses equal components and allows distinct ones without a scopeless warning (#331)", () => {
    fs.writeFileSync(
      path.join(tmpDir, "2026-04-current.md"),
      '---\nstatus: active\ncomponent: "tracker-task-truth"\n---\n',
    );

    assert.throws(() => createSprintFile({
      topic: "duplicate",
      milestone: "M",
      component: "tracker-task-truth",
      sprintsDir: tmpDir,
      repoRoot: tmpDir,
    }), /Active track overlaps on scope: 2026-04-current\.md/);

    const result = createSprintFile({
      topic: "disjoint",
      milestone: "M",
      component: "sprint-execution",
      sprintsDir: tmpDir,
      repoRoot: tmpDir,
    });
    assert.equal(result.component, "sprint-execution");
    assert.deepEqual(result.warnings, []);
    assert.match(result.content, /^component: "sprint-execution"$/m);
  });

  it("rejects a --component value that cannot round-trip through frontmatter", () => {
    for (const bad of ["a\nb", "has space", 'quo"te']) {
      assert.throws(() => buildComponentFrontmatterLine(bad), /single token/);
    }
  });

  it("rejects the retired --dry-run / --json flags and a missing --milestone value (#457)", () => {
    assert.match(parseArgs(["auth", "--dry-run"]).error, /Unknown argument: --dry-run/);
    assert.match(parseArgs(["auth", "--json"]).error, /Unknown argument: --json/);
    assert.match(parseArgs(["auth", "--milestone"]).error, /Missing value for --milestone/);
    assert.match(parseArgs(["auth", "--milestone", "--scope", "src/**"]).error, /Missing value for --milestone/);
  });

  it("exits 1 and creates nothing when --component and --scope are both given (#331)", () => {
    const cli = path.join(SKILL_SCRIPTS, "sprint-init.js");
    const run = spawnSync(process.execPath, [
      cli, "probe", "--component", "one-axis", "--scope", "src/**",
    ], { cwd: tmpDir, encoding: "utf-8" });

    assert.equal(run.status, 1);
    assert.match(run.stdout, /cannot be used together/);
    assert.equal(fs.existsSync(path.join(tmpDir, ".dev-backlog")), false);
  });

  it("exits 1 and creates nothing on a retired flag (#457)", () => {
    const cli = path.join(SKILL_SCRIPTS, "sprint-init.js");
    const run = spawnSync(process.execPath, [cli, "probe", "--dry-run"], { cwd: tmpDir, encoding: "utf-8" });

    assert.equal(run.status, 1);
    assert.match(run.stdout, /Unknown argument: --dry-run/);
    assert.equal(fs.existsSync(path.join(tmpDir, ".dev-backlog")), false);
  });

  it("writes a skeleton with an empty Plan and no placeholder prose", () => {
    const result = createSprintFile({
      topic: "misc",
      milestone: "Sprint W14",
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });

    assert.doesNotMatch(result.content, /Order into parallel-safe batches|add issues here/);
    assert.match(fs.readFileSync(result.sprintFile, "utf-8"), /## Plan\n\n/);
  });

  it("creates a disjoint-scope second active track without refusal (#292)", () => {
    fs.writeFileSync(
      path.join(tmpDir, "2026-04-current.md"),
      '---\nstatus: active\nscope: ["src/auth/**"]\n---\n',
    );

    const result = createSprintFile({
      topic: "billing",
      milestone: "Sprint W14",
      scope: ["src/billing/**"],
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });

    assert.equal(result.created, true);
    assert.deepEqual(result.warnings, []);
    const written = fs.readFileSync(result.sprintFile, "utf-8");
    assert.match(written, /^scope: \["src\/billing\/\*\*"\]$/m);
    assert.match(written, /^status: active$/m);
  });

  it("warns and allows a scopeless sprint next to a scopeless active track (#292)", () => {
    fs.writeFileSync(path.join(tmpDir, "2026-04-current.md"), "---\nstatus: active\n---\n");

    const result = createSprintFile({
      topic: "next-sprint",
      milestone: "Sprint W14",
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });

    assert.equal(result.created, true);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /cannot prove/);
    assert.match(result.warnings[0], /2026-04-current\.md/);
    assert.match(result.warnings[0], /2026-04-next-sprint\.md/);
  });

  it("warns and creates a component sprint next to a scopeless active track (#337)", () => {
    fs.writeFileSync(path.join(tmpDir, "2026-04-current.md"), "---\nstatus: active\n---\n");

    const result = createSprintFile({
      topic: "declared-next",
      milestone: "Sprint W14",
      component: "sprint-execution",
      sprintsDir: tmpDir,
      repoRoot: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });

    assert.equal(result.created, true);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /2026-04-current\.md/);
    assert.doesNotMatch(result.warnings[0], /2026-04-declared-next\.md/);
    assert.equal(fs.existsSync(result.sprintFile), true);
  });

  it("throws when the target sprint file already exists and leaves it untouched", () => {
    fs.writeFileSync(path.join(tmpDir, "2026-04-auth-system.md"), "existing content");

    assert.throws(() => {
      createSprintFile({
        topic: "auth-system",
        milestone: "Sprint W13",
        sprintsDir: tmpDir,
        today: new Date("2026-04-05T09:00:00Z"),
      });
    }, /Sprint file already exists/);
    assert.equal(fs.readFileSync(path.join(tmpDir, "2026-04-auth-system.md"), "utf-8"), "existing content");
  });

  it("creates sprintsDir when it does not exist", () => {
    const nested = path.join(tmpDir, "deep", "sprints");

    createSprintFile({
      topic: "setup",
      milestone: "Sprint W15",
      sprintsDir: nested,
      today: new Date("2026-04-05T09:00:00Z"),
    });

    assert.ok(fs.existsSync(nested));
    const files = fs.readdirSync(nested);
    assert.equal(files.length, 1);
    assert.match(files[0], /^2026-04-setup\.md$/);
  });

  it("produces frontmatter compatible with find_active_sprint", () => {
    const result = createSprintFile({
      topic: "compat-check",
      milestone: "Sprint W15",
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
    });

    const content = fs.readFileSync(result.sprintFile, "utf-8");
    // Frontmatter must have status: active on its own line (what find_active_sprint greps for)
    assert.match(content, /^status: active$/m);
    assert.doesNotMatch(content, /^objectives:/m);
    assert.doesNotMatch(content, /^component:/m);
  });

});
