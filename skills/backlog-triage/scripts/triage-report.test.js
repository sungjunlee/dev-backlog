const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("node:child_process");
const { analyzeSnapshot: analyzeRelationships } = require("./triage-relate.js");
const { analyzeSnapshot: analyzeStale } = require("./triage-stale.js");
const {
  parseArgs,
  parseAnchor,
  buildReportModel,
  renderReport,
  writeReportFile,
} = require("./triage-report.js");

function makeSnapshot() {
  return {
    generated: "2026-04-18T01:30:00.000Z",
    repo: "sungjunlee/dev-backlog",
    config_path: "backlog/triage-config.yml",
    issues: [
      {
        number: 101,
        title: "OAuth token refresh flow",
        body: "Blocks #102. See #105 for docs follow-up.",
        labels: ["type:feature", "priority:medium"],
        createdAt: "2026-04-10T01:30:00.000Z",
        updatedAt: "2026-04-17T01:30:00.000Z",
        milestone: null,
        buckets: {
          label: { type: "feature", priority: "medium", status: "todo" },
          theme: "auth",
          age: "7-30d",
          activity: "recent",
          milestone: "unassigned",
        },
      },
      {
        number: 102,
        title: "OAuth token refresh worker",
        body: "Blocked by #101 and depends on #103.",
        labels: ["type:feature", "priority:medium"],
        createdAt: "2026-04-09T01:30:00.000Z",
        updatedAt: "2026-04-16T01:30:00.000Z",
        milestone: null,
        buckets: {
          label: { type: "feature", priority: "medium", status: "todo" },
          theme: "auth",
          age: "7-30d",
          activity: "recent",
          milestone: "unassigned",
        },
      },
      {
        number: 103,
        title: "Audit token rotation docs",
        body: "Related doc cleanup for auth rollout.",
        labels: ["type:docs", "priority:low"],
        createdAt: "2026-04-08T01:30:00.000Z",
        updatedAt: "2026-04-14T01:30:00.000Z",
        milestone: null,
        buckets: {
          label: { type: "docs", priority: "low", status: "todo" },
          theme: "auth",
          age: "7-30d",
          activity: "warm",
          milestone: "unassigned",
        },
      },
      {
        number: 104,
        title: "Legacy sprint cleanup chore",
        body: "Old backlog task that lost traction.",
        labels: ["type:chore"],
        createdAt: "2025-12-01T01:30:00.000Z",
        updatedAt: "2026-01-01T01:30:00.000Z",
        milestone: null,
        buckets: {
          label: { type: "chore", priority: "medium", status: "todo" },
          theme: "ops",
          age: ">90d",
          activity: "cold",
          milestone: "unassigned",
        },
      },
      {
        number: 105,
        title: "Audit token rotation docs cleanup",
        body: "wontfix after migration plan changed.",
        labels: ["type:docs", "wontfix"],
        createdAt: "2026-03-01T01:30:00.000Z",
        updatedAt: "2026-04-01T01:30:00.000Z",
        milestone: null,
        buckets: {
          label: { type: "docs", priority: "medium", status: "todo" },
          theme: "auth",
          age: "30-90d",
          activity: "warm",
          milestone: "unassigned",
        },
      },
      {
        number: 106,
        title: "Broken import path typo",
        body: "invalid repro; no longer reproducible.",
        labels: ["invalid"],
        createdAt: "2026-03-15T01:30:00.000Z",
        updatedAt: "2026-04-05T01:30:00.000Z",
        milestone: null,
        buckets: {
          label: { type: "uncategorized", priority: "medium", status: "todo" },
          theme: "uncategorized",
          age: "30-90d",
          activity: "warm",
          milestone: "unassigned",
        },
      },
    ],
  };
}

describe("parseArgs", () => {
  it("parses the required and optional renderer flags", () => {
    assert.deepEqual(
      parseArgs(["--snapshot", "snapshot.json", "--relate", "relate.json", "--stale", "stale.json", "--out", "report.md", "--json"]),
      {
        snapshotPath: "snapshot.json",
        relatePath: "relate.json",
        stalePath: "stale.json",
        outPath: "report.md",
        json: true,
      }
    );
  });

  it("errors clearly when snapshot is missing", () => {
    assert.match(parseArgs([]).error, /snapshot/i);
  });
});

describe("parseAnchor", () => {
  it("parses verbs, issue number, and quoted or bare args using the issue #65 grammar", () => {
    const parsed = parseAnchor('<!-- triage:assign-milestone #42 name="Sprint W17" cluster=auth -->');
    assert.deepEqual(parsed, {
      verb: "assign-milestone",
      issueNumber: 42,
      argsText: 'name="Sprint W17" cluster=auth',
      args: {
        name: "Sprint W17",
        cluster: "auth",
      },
    });
  });
});

describe("renderer helpers", () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-report-helper-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("backs up an existing report to .bak before rewriting", () => {
    const reportPath = path.join(tempDir, "report.md");
    fs.writeFileSync(reportPath, "old report\n");

    const first = writeReportFile(reportPath, "new report\n");

    assert.equal(first.path, reportPath);
    assert.equal(first.backupPath, `${reportPath}.bak`);
    assert.equal(fs.readFileSync(reportPath, "utf-8"), "new report\n");
    assert.equal(fs.readFileSync(`${reportPath}.bak`, "utf-8"), "old report\n");
  });

  it("renders no-input placeholders for omitted relate/stale inputs", () => {
    const model = buildReportModel({
      snapshot: makeSnapshot(),
      snapshotPath: "fixtures/snapshot.json",
      relate: null,
      stale: null,
    });

    const markdown = renderReport(model);
    assert.match(markdown, /## Relationships[\s\S]*_\(no input provided\)_/);
    assert.match(markdown, /## Obsolete Candidates[\s\S]*_\(no input provided\)_/);
  });
});

describe("triage-report integration chain", () => {
  let tempDir;
  let snapshotPath;
  let relatePath;
  let stalePath;
  let reportPath;
  let repoRoot;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-report-int-"));
    repoRoot = path.join(tempDir, "repo");
    fs.mkdirSync(path.join(repoRoot, "backlog"), { recursive: true });
    fs.writeFileSync(
      path.join(repoRoot, "backlog", "triage-config.yml"),
      [
        "theme_keywords:",
        "  auth: [auth, oauth, token]",
        "  docs: [docs, readme, guide]",
        "  ops: [ops, cleanup, maintenance]",
        "activity_days:",
        "  warm: 14",
        "  cold: 60",
        "stale_days: 60",
        "duplicate_threshold: 0.5",
        "",
      ].join("\n")
    );

    snapshotPath = path.join(repoRoot, "fixture-snapshot.json");
    relatePath = path.join(repoRoot, "fixture-relate.json");
    stalePath = path.join(repoRoot, "fixture-stale.json");
    reportPath = path.join(repoRoot, "backlog", "triage", "2026-04-18-report.md");

    const snapshot = makeSnapshot();
    fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

    const relate = { edges: analyzeRelationships(snapshot, { config: { duplicate_threshold: 0.5 } }) };
    fs.writeFileSync(relatePath, `${JSON.stringify(relate, null, 2)}\n`);

    const stale = analyzeStale(snapshot, { config: { stale_days: 60 } });
    fs.writeFileSync(
      stalePath,
      `${JSON.stringify(
        {
          snapshot: snapshotPath,
          generated: stale.generated,
          thresholdDays: stale.thresholdDays,
          candidates: stale.candidates,
        },
        null,
        2
      )}\n`
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("renders all report sections, well-formed anchors, and preserves the first report on re-run", () => {
    const scriptPath = path.join(__dirname, "triage-report.js");
    const jsonOut = execFileSync(
      process.execPath,
      [scriptPath, "--snapshot", snapshotPath, "--relate", relatePath, "--stale", stalePath, "--out", reportPath, "--json"],
      {
        cwd: repoRoot,
        encoding: "utf-8",
      }
    );

    const parsedJson = JSON.parse(jsonOut);
    assert.ok(Array.isArray(parsedJson.sections));
    assert.ok(Array.isArray(parsedJson.anchors));

    const markdown = fs.readFileSync(reportPath, "utf-8");
    for (const heading of [
      "## Classification",
      "## Relationships",
      "## Obsolete Candidates",
      "## Priority Proposals",
      "## Milestone Suggestions",
      "## Apply Checklist",
    ]) {
      assert.match(markdown, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }

    assert.match(markdown, /^---\ngenerated: 2026-04-18\nrepo: sungjunlee\/dev-backlog\nsnapshot: .*fixture-snapshot\.json\nopen_issues: 6\n---/m);
    assert.match(markdown, /<!-- triage:close #104 reason="inactive\/stale: no activity for 107 days; exceeds stale_days threshold \(60\); no milestone assigned" -->/);
    assert.match(markdown, /<!-- triage:close #105 reason="labeled wontfix; explicit wontfix signal" -->/);
    assert.match(markdown, /<!-- triage:close #106 reason="labeled invalid; explicit invalid signal" -->/);
    assert.match(markdown, /PR-merged edges deferred/);
    assert.match(markdown, /closing-PR-already-merged and duplicate-of-closed signals deferred/);

    const lines = markdown.split(/\r?\n/);
    const anchorLines = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.includes("<!-- triage:"));
    assert.ok(anchorLines.length >= 6);

    for (const { line, index } of anchorLines) {
      const parsed = parseAnchor(line);
      assert.ok(parsed, `expected parseable anchor: ${line}`);

      const nextNonBlank = lines.slice(index + 1).find((candidate) => candidate.trim() !== "");
      assert.ok(nextNonBlank, `expected checkbox after anchor: ${line}`);
      assert.match(nextNonBlank, /^- \[ \] /);
    }

    const firstReport = markdown;

    execFileSync(
      process.execPath,
      [scriptPath, "--snapshot", snapshotPath, "--relate", relatePath, "--stale", stalePath, "--out", reportPath],
      {
        cwd: repoRoot,
        encoding: "utf-8",
      }
    );

    assert.equal(fs.readFileSync(`${reportPath}.bak`, "utf-8"), firstReport);
    assert.equal(fs.readFileSync(reportPath, "utf-8"), firstReport);
  });

  it("fails clearly when snapshot JSON is malformed", () => {
    fs.writeFileSync(snapshotPath, "{not json}\n");

    assert.throws(
      () =>
        execFileSync(process.execPath, [path.join(__dirname, "triage-report.js"), "--snapshot", snapshotPath], {
          cwd: repoRoot,
          encoding: "utf-8",
          stdio: "pipe",
        }),
      /snapshot|parse|json|malformed/i
    );
  });
});
