const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseArgs,
  runDoctor,
  exitCodeFor,
  formatHumanSummary,
  buildReassessSignal,
} = require("./backlog-doctor.js");

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

function seedCleanRepo(repoRoot, sprintContent = sprint()) {
  write(path.join(repoRoot, "spec", "charter.md"), charter());
  write(path.join(repoRoot, "spec", "capabilities.md"), capabilities());
  write(path.join(repoRoot, "backlog", "sprints", "2026-07-test.md"), sprintContent);
}

function completedSprint({
  closed = "2026-07-01",
  objectives = "[O1]",
  component = "sprint-execution",
} = {}) {
  return sprint({
    status: "completed",
    objectives,
    component,
    progress: `- ${closed}: Sprint closed. 1/1 tasks completed.`,
  });
}

function check(report, name) {
  const found = report.checks.find((item) => item.name === name);
  assert.ok(found, `missing check ${name}`);
  return found;
}

describe("parseArgs", () => {
  it("uses the documented defaults", () => {
    const parsed = parseArgs([]);
    assert.equal(parsed.backlogDir, "backlog");
    assert.equal(parsed.staleDays, 7);
    assert.equal(parsed.json, false);
  });

  it("accepts --json, --stale-days, and a backlog directory", () => {
    const parsed = parseArgs(["--json", "--stale-days", "3", "custom-backlog"]);
    assert.equal(parsed.json, true);
    assert.equal(parsed.staleDays, 3);
    assert.equal(parsed.backlogDir, "custom-backlog");
  });

  it("rejects invalid stale-day values", () => {
    assert.match(parseArgs(["--stale-days", "soon"]).error, /Invalid --stale-days/);
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
      "objectives_check",
      "component_lint",
      "capabilities_doctor",
      "sprint_shape",
      "in_flight_trace",
      "in_flight_staleness",
      "context_bloat",
    ]);
    assert.ok(formatHumanSummary(report).includes("[PASS] active_sprint"));
  });

  it("fails on ambiguous active sprint state", () => {
    seedCleanRepo(repoRoot);
    write(path.join(repoRoot, "backlog", "sprints", "2026-07-second.md"), sprint());

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "active_sprint").status, "fail");
    assert.match(check(report, "active_sprint").detail.summary, /Multiple active sprint files/);
    assert.equal(exitCodeFor(report), 1);
  });

  it("warns when existing sprint files contain no active sprint because that is normal between sprints", () => {
    seedCleanRepo(repoRoot, sprint({ status: "completed" }));

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "active_sprint").status, "warn");
    assert.match(check(report, "active_sprint").detail.summary, /between sprints/);
    assert.equal(report.exit_hint, "warn");
    assert.equal(exitCodeFor(report), 0);
  });

  it("fails on unknown objective IDs", () => {
    seedCleanRepo(repoRoot, sprint({ objectives: "[O99]" }));

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "objectives_check").status, "fail");
    assert.match(check(report, "objectives_check").detail.summary, /objective drift/);
    assert.equal(exitCodeFor(report), 1);
  });

  it("fails on unknown component handles", () => {
    seedCleanRepo(repoRoot, sprint({ component: "unknown-component" }));

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "component_lint").status, "fail");
    assert.match(check(report, "component_lint").detail.summary, /component routing/);
    assert.equal(exitCodeFor(report), 1);
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
    assert.equal(exitCodeFor(report), 0);
    assert.equal(report.exit_hint, "warn");
  });

  it("warns on stale in-flight work beyond --stale-days without failing", () => {
    seedCleanRepo(
      repoRoot,
      sprint({
        started: "2026-07-01",
        plan: "- [~] #1 Needs follow-up [branch:doctor-test]",
      }),
    );

    const report = runDoctor({
      repoRoot,
      staleDays: 3,
      today: new Date("2026-07-05T00:00:00Z"),
    });

    assert.equal(check(report, "in_flight_staleness").status, "warn");
    assert.equal(check(report, "in_flight_staleness").detail.stale_days, 3);
    assert.deepEqual(
      check(report, "in_flight_staleness").detail.items.map((item) => item.issue_number),
      [1],
    );
    assert.equal(exitCodeFor(report), 0);
  });

  it("warns when _context.md exceeds the documented line threshold without failing", () => {
    seedCleanRepo(repoRoot);
    write(
      path.join(repoRoot, "backlog", "sprints", "_context.md"),
      Array.from({ length: 201 }, (_, i) => `line ${i + 1}`).join("\n"),
    );

    const report = runDoctor({ repoRoot });

    assert.equal(check(report, "context_bloat").status, "warn");
    assert.equal(check(report, "context_bloat").detail.threshold_lines, 200);
    assert.equal(exitCodeFor(report), 0);
  });
});

describe("buildReassessSignal", () => {
  let repoRoot;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-doctor-signal-"));
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("recommends reassess when the closing sprint reaches three completed sprints with no reassess reports", () => {
    seedCleanRepo(repoRoot);
    write(path.join(repoRoot, "backlog", "sprints", "2026-06-one.md"), completedSprint());
    write(path.join(repoRoot, "backlog", "sprints", "2026-06-two.md"), completedSprint());

    const doctorReport = runDoctor({ repoRoot });
    const signal = buildReassessSignal({
      repoRoot,
      backlogDir: "backlog",
      doctorReport,
      closingSprintPath: path.join(repoRoot, "backlog", "sprints", "2026-07-test.md"),
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(doctorReport.exit_hint, "pass");
    assert.equal(signal.recommend, true);
    assert.equal(signal.completed_sprints_since_reassess, 3);
    assert.equal(signal.latest_reassess_report, null);
    assert.match(signal.summary, /recommend: spec-charter reassess/);
  });

  it("does not recommend reassess when a fresh reassess report leaves fewer than three closed sprints", () => {
    seedCleanRepo(repoRoot);
    write(path.join(repoRoot, "backlog", "sprints", "2026-06-one.md"), completedSprint({ closed: "2026-06-01" }));
    write(path.join(repoRoot, "backlog", "sprints", "2026-06-two.md"), completedSprint({ closed: "2026-06-02" }));
    write(path.join(repoRoot, "backlog", "triage", "2026-07-03-reassess.md"), "# Reassess\n");

    const doctorReport = runDoctor({ repoRoot });
    const signal = buildReassessSignal({
      repoRoot,
      backlogDir: "backlog",
      doctorReport,
      closingSprintPath: path.join(repoRoot, "backlog", "sprints", "2026-07-test.md"),
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(doctorReport.exit_hint, "pass");
    assert.equal(signal.recommend, false);
    assert.equal(signal.completed_sprints_since_reassess, 1);
    assert.equal(signal.latest_reassess_report, "backlog/triage/2026-07-03-reassess.md");
    assert.match(signal.summary, /no reassess recommendation/);
  });

  it("recommends reassess when the doctor emits a warning even below the sprint-count threshold", () => {
    seedCleanRepo(
      repoRoot,
      sprint({
        plan: "- [~] #1 Needs a pointer",
      }),
    );
    write(path.join(repoRoot, "backlog", "triage", "2026-07-03-reassess.md"), "# Reassess\n");

    const doctorReport = runDoctor({
      repoRoot,
      today: new Date("2026-07-03T00:00:00Z"),
    });
    const signal = buildReassessSignal({
      repoRoot,
      backlogDir: "backlog",
      doctorReport,
      closingSprintPath: path.join(repoRoot, "backlog", "sprints", "2026-07-test.md"),
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(doctorReport.exit_hint, "warn");
    assert.equal(signal.recommend, true);
    assert.equal(signal.doctor_warn_count, 1);
    assert.equal(signal.completed_sprints_since_reassess, 1);
    assert.match(signal.summary, /doctor emitted 1 warning/);
    assert.match(signal.summary, /recommend: spec-charter reassess/);
  });
});
