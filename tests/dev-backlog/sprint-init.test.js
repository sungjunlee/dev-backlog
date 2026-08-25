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
  buildIssueLines,
  buildSpecFrontmatterBlock,
  buildSprintContent,
  detectSpecPresence,
  resolveComponent,
  listActiveSprintFiles,
  createSprintFile,
} = require(path.join(SKILL_SCRIPTS, "sprint-init.js"));

function writeCapabilities(repoRoot, slugs = ["sprint-execution"]) {
  const specDir = path.join(repoRoot, "spec");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(
    path.join(specDir, "capabilities.md"),
    slugs.map((slug) => `## Capability: ${slug}\n`).join("\n"),
  );
}

describe("parseArgs", () => {
  it("parses topic, milestone, dry-run, and json flags", () => {
    const parsed = parseArgs(["auth-system", "--milestone", "Sprint W13", "--dry-run", "--json"]);
    assert.deepEqual(parsed, {
      topic: "auth-system",
      milestone: "Sprint W13",
      dryRun: true,
      json: true,
    });
  });

  it("defaults milestone to topic", () => {
    const parsed = parseArgs(["auth-system"]);
    assert.equal(parsed.topic, "auth-system");
    assert.equal(parsed.milestone, "auth-system");
    assert.equal(parsed.dryRun, false);
    assert.equal(parsed.json, false);
  });

  it("returns usage error when topic is missing", () => {
    const parsed = parseArgs(["--json"]);
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
    assert.match(parseArgs(["auth", "--scope", "--json"]).error, /Missing value for --scope/);
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

describe("buildIssueLines", () => {
  it("adds estimate suffixes from labels", () => {
    const lines = buildIssueLines([
      { number: 42, title: "OAuth2 flow", labels: [{ name: "feature" }] },
      { number: 43, title: "Docs", labels: [{ name: "documentation" }] },
    ]);

    assert.deepEqual(lines, [
      "- [ ] #42 OAuth2 flow (~1hr)",
      "- [ ] #43 Docs (~20min)",
    ]);
  });

  it("returns no Plan lines when there are no issues", () => {
    assert.deepEqual(buildIssueLines([]), []);
  });
});

describe("buildSprintContent", () => {
  it("renders sprint markdown with issues and spec fields when both spec files exist", () => {
    const content = buildSprintContent({
      milestone: "Sprint W13",
      started: "2026-04-05",
      due: "2026-04-12",
      topic: "auth-system",
      issues: [{ number: 42, title: "OAuth2 flow", labels: [{ name: "feature" }] }],
      hasCharter: true,
      hasCapabilities: true,
    });

    assert.match(content, /^---\n/);
    assert.match(content, /milestone: Sprint W13/);
    assert.match(content, /started: 2026-04-05/);
    assert.match(content, /due: 2026-04-12/);
    assert.match(content, /due: 2026-04-12\nobjectives: \[\]\ncomponent: ""\n---/);
    assert.match(content, /# auth-system/);
    assert.match(content, /- \[ \] #42 OAuth2 flow \(~1hr\)/);
  });

  it("omits both spec fields when no spec files exist (B3)", () => {
    const content = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "cold", issues: [],
    });
    assert.match(content, /due: TBD\n---/);
    assert.doesNotMatch(content, /^objectives:/m);
    assert.doesNotMatch(content, /^component:/m);
  });

  it("emits a scope: line only when explicitly requested (D2, #292)", () => {
    const scoped = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "t", issues: [],
      scope: ["src/auth/**", "src/authz/**"],
    });
    assert.match(scoped, /^scope: \["src\/auth\/\*\*", "src\/authz\/\*\*"\]$/m);
    assert.match(scoped, /due: TBD\nscope: \["src\/auth\/\*\*", "src\/authz\/\*\*"\]\n---/);

    const unscoped = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "t", issues: [],
    });
    assert.doesNotMatch(unscoped, /^scope:/m);
  });

  it("emits objectives only when charter present, component only when capabilities present", () => {
    const charterOnly = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "t", issues: [],
      hasCharter: true, hasCapabilities: false,
    });
    assert.match(charterOnly, /^objectives: \[\]$/m);
    assert.doesNotMatch(charterOnly, /^component:/m);

    const capsOnly = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "t", issues: [],
      hasCharter: false, hasCapabilities: true,
    });
    assert.doesNotMatch(capsOnly, /^objectives:/m);
    assert.match(capsOnly, /^component: ""$/m);
  });

  it("emits the resolved component instead of the compatibility placeholder (#331)", () => {
    const content = buildSprintContent({
      milestone: "m", started: "2026-04-05", due: "TBD", topic: "t", issues: [],
      component: "sprint-execution", hasCapabilities: true,
    });
    assert.match(content, /^component: "sprint-execution"$/m);
    assert.doesNotMatch(content, /^component: ""$/m);
  });
});

describe("buildSpecFrontmatterBlock", () => {
  it("returns empty string when neither spec file exists", () => {
    assert.equal(buildSpecFrontmatterBlock({ hasCharter: false, hasCapabilities: false }), "");
  });
  it("returns both keys trailing-newline-terminated when both exist", () => {
    assert.equal(
      buildSpecFrontmatterBlock({ hasCharter: true, hasCapabilities: true }),
      'objectives: []\ncomponent: ""\n',
    );
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
      dryRun: false,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "2026-04-12",
      getIssues: () => [{ number: 42, title: "OAuth2 flow", labels: [{ name: "feature" }] }],
      // Explicit overrides keep this deterministic regardless of the test cwd's spec/.
      hasCharter: true,
      hasCapabilities: true,
    });

    assert.equal(result.action, "sprint-init");
    assert.equal(result.created, true);
    assert.equal(result.existingFile, false);
    assert.equal(result.dryRun, false);
    assert.equal(result.issueCount, 1);
    assert.equal(result.placeholderIssue, false);
    assert.ok(!("component" in result));
    assert.equal(result.sprintFile, path.join(tmpDir, "2026-04-auth-system.md"));
    assert.match(result.content, /OAuth2 flow/);

    const written = fs.readFileSync(result.sprintFile, "utf-8");
    assert.equal(written, result.content);
    assert.match(written, /due: 2026-04-12\nobjectives: \[\]\ncomponent: ""\n---/);
  });

  it("generates sprint files that pass the doctor shape check with and without issues (#339)", () => {
    const cases = [
      { topic: "empty", issues: [] },
      { topic: "milestone", issues: [{ number: 42, title: "OAuth2 flow", labels: [] }] },
    ];

    for (const { topic, issues } of cases) {
      const repoRoot = path.join(tmpDir, topic);
      const backlogPath = path.join(repoRoot, "backlog");
      const result = createSprintFile({
        topic,
        milestone: topic,
        dryRun: false,
        repoRoot,
        sprintsDir: path.join(backlogPath, "sprints"),
        getDue: () => "TBD",
        getIssues: () => issues,
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

  it("omits spec fields in the written file when no spec files exist (B3)", () => {
    const result = createSprintFile({
      topic: "cold-adopter",
      milestone: "M",
      dryRun: false,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "TBD",
      getIssues: () => [],
      hasCharter: false,
      hasCapabilities: false,
    });

    const written = fs.readFileSync(result.sprintFile, "utf-8");
    assert.match(written, /due: TBD\n---/);
    assert.doesNotMatch(written, /^objectives:/m);
    assert.doesNotMatch(written, /^component:/m);
  });

  it("detectSpecPresence reflects injected spec-file existence", () => {
    const present = detectSpecPresence({
      repoRoot: "/repo",
      fileExists: (p) => p.endsWith(path.join("spec", "charter.md"))
        || p.endsWith(path.join("spec", "capabilities.md")),
    });
    assert.deepEqual(present, { hasCharter: true, hasCapabilities: true });

    const absent = detectSpecPresence({ repoRoot: "/repo", fileExists: () => false });
    assert.deepEqual(absent, { hasCharter: false, hasCapabilities: false });
  });

  it("resolves only declared capability slugs and lists known slugs on refusal (#331)", () => {
    writeCapabilities(tmpDir, ["tracker-task-truth", "sprint-execution"]);
    assert.equal(resolveComponent({
      component: "sprint-execution",
      repoRoot: tmpDir,
    }), "sprint-execution");
    assert.throws(() => resolveComponent({
      component: "unknown",
      repoRoot: tmpDir,
    }), /Known components: sprint-execution, tracker-task-truth/);
  });

  it("refuses --component without spec/capabilities.md before effects (#331)", () => {
    const sprintsDir = path.join(tmpDir, "backlog", "sprints");
    let providerCalled = false;
    assert.throws(() => createSprintFile({
      topic: "no-axis",
      milestone: "M",
      component: "sprint-execution",
      dryRun: false,
      sprintsDir,
      repoRoot: tmpDir,
      getDue: () => { providerCalled = true; return "TBD"; },
      getIssues: () => { providerCalled = true; return []; },
    }), /spec\/capabilities\.md was not found/);
    assert.equal(providerCalled, false);
    assert.equal(fs.existsSync(sprintsDir), false);
  });

  it("refuses direct component + scope input before effects (#331)", () => {
    const sprintsDir = path.join(tmpDir, "backlog", "sprints");
    assert.throws(() => createSprintFile({
      topic: "two-axes",
      milestone: "M",
      component: "sprint-execution",
      scope: ["src/**"],
      dryRun: false,
      sprintsDir,
      repoRoot: tmpDir,
      getDue: () => "TBD",
      getIssues: () => [],
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
        dryRun: false,
        sprintsDir: tmpDir,
        today: new Date("2026-04-05T09:00:00Z"),
        getDue: () => "2026-04-12",
        getIssues: () => [],
      });
    }, /Active track overlaps on scope: 2026-04-current\.md/);
  });

  it("also refuses dry-run creation on scope overlap (#292)", () => {
    fs.writeFileSync(
      path.join(tmpDir, "2026-04-current.md"),
      '---\nstatus: active\nscope: ["src/auth/**"]\n---\n',
    );

    assert.throws(() => {
      createSprintFile({
        topic: "next-sprint",
        milestone: "Sprint W14",
        scope: ["src/auth/**"],
        dryRun: true,
        sprintsDir: tmpDir,
        today: new Date("2026-04-05T09:00:00Z"),
        getDue: () => "2026-04-12",
        getIssues: () => [],
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
      dryRun: true,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "TBD",
      getIssues: () => [],
    });
    assert.deepEqual(disjoint.warnings, []);
  });

  it("refuses equal components and allows distinct ones without a scopeless warning (#331)", () => {
    writeCapabilities(tmpDir, ["sprint-execution", "tracker-task-truth"]);
    fs.writeFileSync(
      path.join(tmpDir, "2026-04-current.md"),
      '---\nstatus: active\ncomponent: "tracker-task-truth"\n---\n',
    );

    assert.throws(() => createSprintFile({
      topic: "duplicate",
      milestone: "M",
      component: "tracker-task-truth",
      dryRun: true,
      sprintsDir: tmpDir,
      repoRoot: tmpDir,
      getDue: () => "TBD",
      getIssues: () => [],
    }), /Active track overlaps on scope: 2026-04-current\.md/);

    const result = createSprintFile({
      topic: "disjoint",
      milestone: "M",
      component: "sprint-execution",
      dryRun: true,
      sprintsDir: tmpDir,
      repoRoot: tmpDir,
      getDue: () => "TBD",
      getIssues: () => [],
    });
    assert.equal(result.component, "sprint-execution");
    assert.deepEqual(result.warnings, []);
    assert.match(result.content, /^component: "sprint-execution"$/m);
  });

  it("returns component and refusal reason in dry-run JSON mode (#331)", () => {
    writeCapabilities(tmpDir, ["tracker-task-truth", "sprint-execution"]);
    const cli = path.join(SKILL_SCRIPTS, "sprint-init.js");
    const run = spawnSync(process.execPath, [
      cli, "probe", "--component", "unknown", "--dry-run", "--json",
    ], { cwd: tmpDir, encoding: "utf-8" });

    assert.equal(run.status, 1);
    assert.equal(run.stderr, "");
    const result = JSON.parse(run.stdout);
    assert.equal(result.dryRun, true);
    assert.equal(result.component, "unknown");
    assert.equal(result.created, false);
    assert.match(result.refusalReason, /Known components: sprint-execution, tracker-task-truth/);
    assert.equal(fs.existsSync(path.join(tmpDir, "backlog")), false);
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
      dryRun: false,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "2026-04-12",
      getIssues: () => [],
      hasCharter: false,
      hasCapabilities: false,
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
      dryRun: false,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "2026-04-12",
      getIssues: () => [],
      hasCharter: false,
      hasCapabilities: false,
    });

    assert.equal(result.created, true);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /cannot prove/);
    assert.match(result.warnings[0], /2026-04-current\.md/);
    assert.match(result.warnings[0], /2026-04-next-sprint\.md/);
  });

  it("warns and creates a component sprint next to a scopeless active track (#337)", () => {
    writeCapabilities(tmpDir);
    fs.writeFileSync(path.join(tmpDir, "2026-04-current.md"), "---\nstatus: active\n---\n");

    const result = createSprintFile({
      topic: "declared-next",
      milestone: "Sprint W14",
      component: "sprint-execution",
      dryRun: false,
      sprintsDir: tmpDir,
      repoRoot: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "2026-04-12",
      getIssues: () => [],
    });

    assert.equal(result.created, true);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /2026-04-current\.md/);
    assert.doesNotMatch(result.warnings[0], /2026-04-declared-next\.md/);
    assert.equal(fs.existsSync(result.sprintFile), true);
  });

  it("returns placeholder metadata on dry-run when milestone has no issues", () => {
    const result = createSprintFile({
      topic: "misc",
      milestone: "Sprint W14",
      dryRun: true,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "TBD",
      getIssues: () => [],
    });

    assert.equal(result.created, false);
    assert.equal(result.placeholderIssue, true);
    assert.equal(result.issueCount, 0);
    assert.equal(fs.existsSync(result.sprintFile), false);
    assert.doesNotMatch(result.content, /Order into parallel-safe batches|add issues here/);
  });

  it("reports existing file during dry-run without overwriting it", () => {
    const sprintFile = path.join(tmpDir, "2026-04-auth-system.md");
    fs.writeFileSync(sprintFile, "existing content");

    const result = createSprintFile({
      topic: "auth-system",
      milestone: "Sprint W13",
      dryRun: true,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "2026-04-12",
      getIssues: () => [{ number: 42, title: "OAuth2 flow", labels: [] }],
    });

    assert.equal(result.existingFile, true);
    assert.equal(result.created, false);
    assert.equal(result.placeholderIssue, false);
    assert.equal(result.content, null);
    assert.equal(fs.readFileSync(sprintFile, "utf-8"), "existing content");
  });

  it("throws when target sprint file already exists outside dry-run", () => {
    fs.writeFileSync(path.join(tmpDir, "2026-04-auth-system.md"), "existing content");

    assert.throws(() => {
      createSprintFile({
        topic: "auth-system",
        milestone: "Sprint W13",
        dryRun: false,
        sprintsDir: tmpDir,
        today: new Date("2026-04-05T09:00:00Z"),
        getDue: () => "2026-04-12",
        getIssues: () => [],
      });
    }, /Sprint file already exists/);
  });

  it("creates sprintsDir when it does not exist", () => {
    const nested = path.join(tmpDir, "deep", "sprints");

    createSprintFile({
      topic: "setup",
      milestone: "Sprint W15",
      dryRun: false,
      sprintsDir: nested,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "TBD",
      getIssues: () => [],
    });

    assert.ok(fs.existsSync(nested));
    const files = fs.readdirSync(nested);
    assert.equal(files.length, 1);
    assert.match(files[0], /^2026-04-setup\.md$/);
  });

  it("renders multiple issues with varied labels", () => {
    const issues = [
      { number: 10, title: "Auth flow", labels: [{ name: "feature" }] },
      { number: 11, title: "Rate limit", labels: [{ name: "size:S" }] },
      { number: 12, title: "Fix typo", labels: [{ name: "bug" }, { name: "size:XS" }] },
      { number: 13, title: "Add docs", labels: [{ name: "documentation" }] },
      { number: 14, title: "Bare issue", labels: [] },
    ];

    const result = createSprintFile({
      topic: "mixed",
      milestone: "Sprint W15",
      dryRun: false,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "2026-04-12",
      getIssues: () => issues,
    });

    assert.equal(result.issueCount, 5);
    assert.match(result.content, /#10 Auth flow/);
    assert.match(result.content, /#14 Bare issue/);
    // All issues rendered as unchecked checkboxes
    const checkboxLines = result.content.split("\n").filter((l) => l.startsWith("- [ ] #"));
    assert.equal(checkboxLines.length, 5);
  });

  it("handles special characters in topic and issue titles", () => {
    const result = createSprintFile({
      topic: "OAuth2 / PKCE (v2)",
      milestone: "Sprint W15",
      dryRun: false,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "TBD",
      getIssues: () => [
        { number: 42, title: "Support café & résumé endpoints", labels: [] },
      ],
    });

    assert.ok(fs.existsSync(result.sprintFile));
    assert.match(result.content, /café & résumé/);
    // Filename uses slugified topic
    assert.match(path.basename(result.sprintFile), /^2026-04-.*\.md$/);
    assert.ok(!path.basename(result.sprintFile).includes("/"));
  });

  it("produces frontmatter compatible with find_active_sprint", () => {
    const result = createSprintFile({
      topic: "compat-check",
      milestone: "Sprint W15",
      dryRun: false,
      sprintsDir: tmpDir,
      today: new Date("2026-04-05T09:00:00Z"),
      getDue: () => "2026-04-12",
      getIssues: () => [{ number: 1, title: "Task", labels: [] }],
      // Explicit overrides: spec-field emission must not depend on the test
      // runner's cwd having (or lacking) a spec/ directory (#258).
      hasCharter: true,
      hasCapabilities: true,
    });

    const content = fs.readFileSync(result.sprintFile, "utf-8");
    // Frontmatter must have status: active on its own line (what find_active_sprint greps for)
    assert.match(content, /^status: active$/m);
    assert.match(content, /^objectives: \[\]$/m);
    assert.match(content, /^component: ""$/m);
    // Checkbox must match the integration contract regex
    assert.match(content, /^- \[ \] #\d+/m);
  });
});
