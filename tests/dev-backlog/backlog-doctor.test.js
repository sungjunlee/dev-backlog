const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  parseArgs,
  runDoctor,
  exitCodeFor,
  formatHumanSummary,
} = require(path.join(SKILL_SCRIPTS, "backlog-doctor.js"));

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function charter() {
  return `# Charter

## Objectives
- O1 [active]    keep execution state readable · src: test
`;
}

function capabilities() {
  return `# Capabilities

## Capability: sprint-execution

### Learnings
<!-- LEARN:BEGIN -->
<!-- LEARN:END -->
`;
}

function sprint({
  status = "active",
  objectives = "[O1]",
  component = "sprint-execution",
  started = "2026-07-03",
  goal = "Keep the sprint healthy.",
  plan = "- [ ] #1 Ship the health check",
  runningContext = "- Follow existing script contracts.",
  progress = "- 2026-07-03: Started.",
  omitSections = [],
} = {}) {
  const sections = [
    ["Goal", goal],
    ["Plan", plan],
    ["Running Context", runningContext],
    ["Progress", progress],
  ]
    .filter(([name]) => !omitSections.includes(name))
    .map(([name, body]) => `## ${name}\n${body}`)
    .join("\n\n");

  return `---
status: ${status}
started: ${started}
objectives: ${objectives}
component: "${component}"
---

# Test Sprint

${sections}
`;
}

// A sprint whose spec-axis frontmatter keys can each be present-empty, present-
// valued, or fully omitted (pass no value). Used to exercise the B3 omission
// paths and, via scope:, the multi-track disjointness paths (#293).
function sprintNoSpecFields({ objectives, component, scope, plan = "- [ ] #1 Ship the health check" } = {}) {
  const fm = ["---", "status: active", "started: 2026-07-03"];
  if (objectives !== undefined) fm.push(`objectives: ${objectives}`);
  if (component !== undefined) fm.push(`component: "${component}"`);
  if (scope !== undefined) fm.push(`scope: ${scope}`);
  fm.push("---");
  return `${fm.join("\n")}

# Test Sprint

## Goal
Keep the sprint healthy.

## Plan
${plan}

## Running Context
- Follow existing script contracts.

## Progress
- 2026-07-03: Started.
`;
}

function seedCleanRepo(repoRoot, sprintContent = sprint()) {
  write(path.join(repoRoot, "spec", "charter.md"), charter());
  write(path.join(repoRoot, "spec", "capabilities.md"), capabilities());
  write(path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-test.md"), sprintContent);
}

function check(report, name) {
  const found = report.checks.find((item) => item.name === name);
  assert.ok(found, `missing check ${name}`);
  return found;
}

describe("parseArgs", () => {
  it("uses the documented defaults", () => {
    const parsed = parseArgs([]);
    assert.equal(parsed.backlogDir, ".dev-backlog");
    assert.equal(parsed.json, false);
  });

  it("accepts --json and a backlog directory", () => {
    const parsed = parseArgs(["--json", "custom-backlog"]);
    assert.equal(parsed.json, true);
    assert.equal(parsed.backlogDir, "custom-backlog");
  });

  it("rejects --stale-days as an unknown argument", () => {
    assert.match(parseArgs(["--stale-days"]).error, /Unknown argument: --stale-days/);
  });
});

describe("runDoctor", () => {
  let repoRoot;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-doctor-"));
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("passes a clean fixture and emits stable JSON check families", () => {
    seedCleanRepo(repoRoot);

    const report = runDoctor({
      repoRoot,
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(report.schema_version, 1);
    assert.equal(report.exit_hint, "pass");
    assert.equal(exitCodeFor(report), 0);
    assert.deepEqual(report.checks.map((item) => item.name), [
      "active_sprint",
      "sprint_shape",
      "in_flight_trace",
    ]);
    assert.ok(formatHumanSummary(report).includes("[PASS] active_sprint"));
    // G4: a single active track never grows track tags (text and JSON alike).
    assert.ok(report.checks.every((item) => item.track === undefined));
  });

  it("ignores a leftover .tracker file and a stale config.yml tracker key (#445)", () => {
    seedCleanRepo(repoRoot);
    write(path.join(repoRoot, ".dev-backlog", ".tracker"), "local\n");
    write(
      path.join(repoRoot, ".dev-backlog", "config.yml"),
      "project_name: fixture\ntracker: github\n"
    );

    const report = runDoctor({ repoRoot });
    assert.equal(report.checks.some((item) => item.name === "tracker_selection"), false);
    assert.equal(report.exit_hint, "pass");
    assert.equal(exitCodeFor(report), 0);
  });

  it("emits no reassess signal and no legacy-root verdict; both retired with #446", () => {
    seedCleanRepo(repoRoot);
    write(path.join(repoRoot, "backlog", "sprints", "leftover.md"), "# leftover\n");

    const report = runDoctor({ repoRoot });

    assert.equal("reassess_signal" in report, false);
    for (const name of ["legacy_execution_root", "reassess_signal"]) {
      assert.equal(report.checks.some((item) => item.name === name), false, `${name} is gone`);
    }
    assert.doesNotMatch(formatHumanSummary(report), /Reassess signal/);
    assert.equal(report.exit_hint, "pass");
    assert.equal(exitCodeFor(report), 0);
  });

  it("fails when two active tracks share the same component (scope overlap, #293)", () => {
    seedCleanRepo(repoRoot);
    write(path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-second.md"), sprint());

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "active_sprint").status, "fail");
    assert.match(check(report, "active_sprint").detail.summary, /Active tracks overlap on scope/);
    assert.equal(exitCodeFor(report), 1);
  });

  it("passes disjoint-scope active tracks as a portfolio and fans per-sprint checks out per track (#293)", () => {
    write(
      path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-auth.md"),
      sprintNoSpecFields({ scope: '["src/auth/**"]' }),
    );
    write(
      path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-billing.md"),
      sprintNoSpecFields({ scope: '["src/billing/**"]' }),
    );

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    assert.equal(check(report, "active_sprint").status, "pass");
    assert.match(check(report, "active_sprint").detail.summary, /2 active tracks, scopes disjoint/);
    assert.equal(exitCodeFor(report), 0);

    for (const name of ["sprint_shape", "in_flight_trace"]) {
      const fanned = report.checks.filter((item) => item.name === name);
      assert.equal(fanned.length, 2, `${name} should run once per track`);
      assert.deepEqual(fanned.map((item) => item.track), ["2026-07-auth", "2026-07-billing"]);
    }
    assert.match(formatHumanSummary(report), /\[PASS\] sprint_shape \[2026-07-auth\]/);
  });

  it("passes a single scopeless active track because there is nothing to be disjoint from (#337)", () => {
    write(path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-one.md"), sprintNoSpecFields());

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    assert.equal(check(report, "active_sprint").status, "pass");
    assert.equal(exitCodeFor(report), 0);
  });

  it("passes a mirrorless GitHub backlog with no tasks or completed directories (#347)", () => {
    write(path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-one.md"), sprintNoSpecFields());

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    assert.equal(fs.existsSync(path.join(repoRoot, ".dev-backlog", "tasks")), false);
    assert.equal(fs.existsSync(path.join(repoRoot, ".dev-backlog", "completed")), false);
    assert.equal(check(report, "active_sprint").status, "pass");
    assert.equal(check(report, "sprint_shape").status, "pass");
    assert.equal(report.exit_hint, "pass");
    assert.equal(exitCodeFor(report), 0);
  });

  it("tags per-track verdicts so a warn names the track it belongs to (#293)", () => {
    write(
      path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-auth.md"),
      sprintNoSpecFields({ scope: '["src/auth/**"]', plan: "- [~] #1 Needs a pointer" }),
    );
    write(
      path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-billing.md"),
      sprintNoSpecFields({ scope: '["src/billing/**"]' }),
    );

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    const traces = report.checks.filter((item) => item.name === "in_flight_trace");
    assert.deepEqual(
      traces.map((item) => [item.track, item.status]),
      [["2026-07-auth", "warn"], ["2026-07-billing", "pass"]],
    );
    assert.equal(exitCodeFor(report), 0);
  });

  it("fails when active tracks overlap via nested scope globs (#293)", () => {
    write(
      path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-auth-a.md"),
      sprintNoSpecFields({ scope: '["src/auth/**"]' }),
    );
    write(
      path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-auth-b.md"),
      sprintNoSpecFields({ scope: '["src/auth/api/**"]' }),
    );

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "active_sprint").status, "fail");
    assert.match(check(report, "active_sprint").detail.summary, /Active tracks overlap on scope/);
    assert.deepEqual(check(report, "active_sprint").detail.overlapping_files, [
      ".dev-backlog/sprints/2026-07-auth-a.md",
      ".dev-backlog/sprints/2026-07-auth-b.md",
    ]);
    assert.equal(exitCodeFor(report), 1);
  });

  it("warns informationally when one of two active tracks is scopeless (#337)", () => {
    write(
      path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-declared.md"),
      sprintNoSpecFields({ scope: '["src/declared/**"]' }),
    );
    write(path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-scopeless.md"), sprintNoSpecFields());

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    const activeCheck = check(report, "active_sprint");
    assert.equal(activeCheck.status, "warn");
    assert.equal(activeCheck.informational, true);
    assert.deepEqual(activeCheck.detail.scopeless_files, [
      ".dev-backlog/sprints/2026-07-scopeless.md",
    ]);
    assert.match(activeCheck.detail.summary, /2026-07-scopeless\.md/);
    assert.equal(exitCodeFor(report), 0);
  });

  it("still warns informationally when both active tracks are scopeless (#293, #337)", () => {
    write(path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-one.md"), sprintNoSpecFields());
    write(path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-two.md"), sprintNoSpecFields());

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    const activeCheck = check(report, "active_sprint");
    assert.equal(activeCheck.status, "warn");
    assert.equal(activeCheck.informational, true);
    assert.match(activeCheck.detail.summary, /cannot prove disjoint/);
    assert.match(activeCheck.detail.summary, /2026-07-one\.md/);
    assert.match(activeCheck.detail.summary, /2026-07-two\.md/);
    assert.equal(exitCodeFor(report), 0);
  });

  it("warns when existing sprint files contain no active sprint because that is normal between sprints", () => {
    seedCleanRepo(repoRoot, sprint({ status: "completed" }));

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "active_sprint").status, "warn");
    assert.match(check(report, "active_sprint").detail.summary, /between sprints/);
    assert.equal(report.exit_hint, "warn");
    assert.equal(exitCodeFor(report), 0);
  });

  it("emits no spec-axis verdict even when spec/ is present (#426)", () => {
    seedCleanRepo(repoRoot);

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    for (const name of ["objectives_check", "component_lint", "capabilities_doctor"]) {
      assert.equal(report.checks.some((item) => item.name === name), false, `${name} is gone`);
    }
  });

  it("ignores unknown objective IDs and component handles; they are unchecked metadata (#426)", () => {
    seedCleanRepo(repoRoot, sprint({ objectives: "[O99]", component: "unknown-component" }));

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    assert.equal(report.exit_hint, "pass");
    assert.equal(exitCodeFor(report), 0);
  });

  it("tolerates explicit empty spec fields on a legacy sprint (additive tolerance)", () => {
    seedCleanRepo(repoRoot, sprintNoSpecFields({ objectives: "[]", component: "" }));

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    assert.equal(report.exit_hint, "pass");
    assert.equal(exitCodeFor(report), 0);
  });

  it("passes when spec files are absent and the sprint omits both fields (cold adopter)", () => {
    write(path.join(repoRoot, ".dev-backlog", "sprints", "2026-07-test.md"), sprintNoSpecFields());

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    assert.equal(report.exit_hint, "pass");
    assert.equal(exitCodeFor(report), 0);
  });

  it("fails when the active sprint is missing a required section", () => {
    seedCleanRepo(repoRoot, sprint({ omitSections: ["Running Context"] }));

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "sprint_shape").status, "fail");
    assert.deepEqual(check(report, "sprint_shape").detail.missing_sections, ["Running Context"]);
    assert.equal(exitCodeFor(report), 1);
  });

  it("fails when a Plan line cannot be parsed by the checkbox grammar", () => {
    seedCleanRepo(repoRoot, sprint({ plan: "- [y] #1 Invalid state" }));

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "sprint_shape").status, "fail");
    assert.deepEqual(
      check(report, "sprint_shape").detail.unparseable_plan_lines.map((item) => item.line),
      ["- [y] #1 Invalid state"],
    );
    assert.equal(exitCodeFor(report), 1);
  });

  it("warns on unmoored in-flight work without failing", () => {
    seedCleanRepo(repoRoot, sprint({ plan: "- [~] #1 Needs a pointer" }));

    const report = runDoctor({
      repoRoot,
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(check(report, "in_flight_trace").status, "warn");
    assert.match(check(report, "in_flight_trace").detail.summary, /unmoored/);
    // C3: the warn itself carries the one-line remediation (no runbook file).
    assert.match(check(report, "in_flight_trace").detail.summary, /→ PR #N \(state\)/);
    assert.match(check(report, "in_flight_trace").detail.summary, /\[branch:name\]/);
    assert.match(check(report, "in_flight_trace").detail.summary, /revert the item to \[ \]/);
    assert.equal(exitCodeFor(report), 0);
    assert.equal(report.exit_hint, "warn");
  });
});
