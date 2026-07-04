const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseArgs,
  runDoctor,
  runCloseSummary,
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

  it("fires when the closing sprint reaches three completed sprints with no reassess reports (no-reports-exist: all completed sprints count)", () => {
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
    assert.equal(signal.fired, true);
    assert.equal(signal.sprints_since_last_report, 3);
    assert.equal(signal.latest_report, null);
    assert.match(signal.reason, /3 sprints closed since last reassess \(threshold 3\)/);
  });

  it("stays quiet between sprints: the informational zero-active warn does not fire the signal", () => {
    write(path.join(repoRoot, "spec", "charter.md"), charter());
    write(path.join(repoRoot, "spec", "capabilities.md"), capabilities());
    write(path.join(repoRoot, "backlog", "sprints", "2026-06-one.md"), completedSprint({ closed: "2026-06-01" }));
    write(path.join(repoRoot, "backlog", "triage", "2026-07-03-reassess.md"), "# Reassess\n");

    const doctorReport = runDoctor({ repoRoot });
    const activeCheck = doctorReport.checks.find((check) => check.name === "active_sprint");
    assert.equal(activeCheck.status, "warn");
    assert.equal(activeCheck.informational, true);
    assert.equal(doctorReport.exit_hint, "warn");

    const signal = buildReassessSignal({
      repoRoot,
      backlogDir: "backlog",
      doctorReport,
      today: new Date("2026-07-04T00:00:00Z"),
    });

    assert.equal(signal.fired, false);
    assert.equal(signal.doctor_warn_count, 0);
    assert.equal(signal.sprints_since_last_report, 0);
    assert.match(signal.reason, /doctor clean/);
  });

  it("is quiet when a sprint closes on the same day as the latest reassess report (same-day rule: covered, not counted)", () => {
    seedCleanRepo(repoRoot);
    // Two sprints closed strictly before the report date; they would not be
    // enough to fire on their own, but the point under test is the sprint
    // closing *today*, on the same date as the report itself.
    write(path.join(repoRoot, "backlog", "sprints", "2026-06-one.md"), completedSprint({ closed: "2026-06-01" }));
    write(path.join(repoRoot, "backlog", "sprints", "2026-06-two.md"), completedSprint({ closed: "2026-06-02" }));
    write(path.join(repoRoot, "backlog", "triage", "2026-07-03-reassess.md"), "# Reassess\n");

    const doctorReport = runDoctor({ repoRoot });
    const signal = buildReassessSignal({
      repoRoot,
      backlogDir: "backlog",
      doctorReport,
      // Closing sprint's accounting date is "today" == the report's own date.
      closingSprintPath: path.join(repoRoot, "backlog", "sprints", "2026-07-test.md"),
      today: new Date("2026-07-03T00:00:00Z"),
    });

    assert.equal(doctorReport.exit_hint, "pass");
    assert.equal(signal.fired, false);
    assert.equal(signal.sprints_since_last_report, 0);
    assert.equal(signal.latest_report, "backlog/triage/2026-07-03-reassess.md");
    assert.match(signal.reason, /doctor clean/);
    assert.match(signal.reason, /0\/3 sprint\(s\) closed since last reassess/);
  });

  it("accumulates strictly-later closes day by day and fires once three are reached", () => {
    seedCleanRepo(repoRoot);
    write(path.join(repoRoot, "backlog", "triage", "2026-07-01-reassess.md"), "# Reassess\n");
    write(path.join(repoRoot, "backlog", "sprints", "2026-07-two.md"), completedSprint({ closed: "2026-07-02" }));
    write(path.join(repoRoot, "backlog", "sprints", "2026-07-three.md"), completedSprint({ closed: "2026-07-03" }));

    const doctorReport = runDoctor({ repoRoot });

    // Two strictly-later closes: below threshold, quiet.
    const belowThreshold = buildReassessSignal({
      repoRoot,
      backlogDir: "backlog",
      doctorReport,
      today: new Date("2026-07-03T00:00:00Z"),
    });
    assert.equal(belowThreshold.sprints_since_last_report, 2);
    assert.equal(belowThreshold.fired, false);

    // A third strictly-later close (the sprint being closed today) tips it to fired.
    const atThreshold = buildReassessSignal({
      repoRoot,
      backlogDir: "backlog",
      doctorReport,
      closingSprintPath: path.join(repoRoot, "backlog", "sprints", "2026-07-test.md"),
      today: new Date("2026-07-04T00:00:00Z"),
    });
    assert.equal(atThreshold.sprints_since_last_report, 3);
    assert.equal(atThreshold.fired, true);
    assert.match(atThreshold.reason, /3 sprints closed since last reassess \(threshold 3\)/);
  });

  it("fires when the doctor emits a warning even below the sprint-count threshold", () => {
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
    assert.equal(signal.fired, true);
    assert.equal(signal.doctor_warn_count, 1);
    // The closing sprint closes the same day as the report: covered, not counted.
    assert.equal(signal.sprints_since_last_report, 0);
    assert.match(signal.reason, /doctor emitted 1 warning/);
  });
});

describe("reassess_signal on the doctor JSON surface", () => {
  let repoRoot;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-doctor-json-"));
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("is a top-level field of runDoctor()'s plain report, with all four documented keys and correct types", () => {
    seedCleanRepo(repoRoot);

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    assert.ok("reassess_signal" in report, "runDoctor() report is missing reassess_signal");
    const signal = report.reassess_signal;
    assert.equal(typeof signal.fired, "boolean");
    assert.equal(typeof signal.reason, "string");
    assert.equal(typeof signal.sprints_since_last_report, "number");
    assert.ok(signal.latest_report === null || typeof signal.latest_report === "string");
  });

  it("no reports exist: all completed sprints count toward the threshold", () => {
    seedCleanRepo(repoRoot);
    write(path.join(repoRoot, "backlog", "sprints", "2026-06-one.md"), completedSprint({ closed: "2026-06-01" }));
    write(path.join(repoRoot, "backlog", "sprints", "2026-06-two.md"), completedSprint({ closed: "2026-06-02" }));

    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    assert.equal(report.reassess_signal.latest_report, null);
    assert.equal(report.reassess_signal.sprints_since_last_report, 2);
  });

  it("human summary includes a matching Reassess signal line", () => {
    seedCleanRepo(repoRoot);
    const report = runDoctor({ repoRoot, today: new Date("2026-07-03T00:00:00Z") });

    const human = formatHumanSummary(report);
    assert.match(human, /Reassess signal: quiet - doctor clean/);
  });

  it("the close path consumes the same single accounting function -- runCloseSummary exposes only doctor_report, and its reassess_signal equals an equivalent direct runDoctor() call", () => {
    seedCleanRepo(repoRoot);
    const closingSprintPath = path.join(repoRoot, "backlog", "sprints", "2026-07-test.md");
    const today = new Date("2026-07-03T00:00:00Z");

    const closeResult = runCloseSummary({ repoRoot, closingSprintPath, today });
    assert.deepEqual(Object.keys(closeResult), ["doctor_report"]);

    const directReport = runDoctor({ repoRoot, closingSprintPath, today });
    assert.deepEqual(closeResult.doctor_report.reassess_signal, directReport.reassess_signal);
  });
});
