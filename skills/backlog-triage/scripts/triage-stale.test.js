const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  SIGNALS,
  DEFAULT_STALE_DAYS,
  parseArgs,
  readSnapshot,
  pickAction,
  scanInactive,
  scanWontfixInvalid,
  resolveThresholdDays,
  analyzeSnapshot,
} = require("./triage-stale.js");

const FIXTURE_PATH = path.join(__dirname, "__fixtures__", "triage-stale", "snapshot.json");

function loadFixtureSnapshot() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
}

describe("parseArgs", () => {
  it("parses --snapshot, --since, and --json", () => {
    assert.deepEqual(parseArgs(["--snapshot", "snapshot.json", "--since", "30", "--json"]), {
      snapshotPath: "snapshot.json",
      since: 30,
      json: true,
    });
  });

  it("rejects missing snapshot and invalid since values", () => {
    assert.match(parseArgs([]).error, /snapshot/i);
    assert.match(parseArgs(["--snapshot", "snapshot.json", "--since", "-1"]).error, /since/i);
  });
});

describe("readSnapshot", () => {
  const tmpDir = path.join(os.tmpdir(), "triage-stale-read-test");

  beforeEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads the fixture snapshot successfully", () => {
    const snapshot = readSnapshot(FIXTURE_PATH);
    assert.equal(snapshot.issues.length, 5);
    assert.equal(snapshot.generated, "2026-08-01T00:00:00.000Z");
  });

  it("errors clearly on malformed snapshot JSON", () => {
    const badPath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(badPath, "not json\n");
    assert.throws(() => readSnapshot(badPath), /snapshot|json|malformed/i);
  });
});

describe("pickAction", () => {
  it("routes inactive and label-based stale signals to close", () => {
    assert.equal(pickAction(SIGNALS.INACTIVE), "close");
    assert.equal(pickAction(SIGNALS.WONTFIX), "close");
    assert.equal(pickAction(SIGNALS.INVALID), "close");
  });

  it("keeps revisit and merge-into actions available for future signals", () => {
    assert.equal(pickAction("future-signal", { targetIssueNumber: 42 }), "merge-into:#42");
    assert.equal(pickAction("future-signal"), "revisit");
  });
});

describe("scanInactive stale/old signal", () => {
  it("flags inactive old issues with no milestone and carries threshold evidence", () => {
    const snapshot = loadFixtureSnapshot();
    const issue = snapshot.issues.find((entry) => entry.number === 500);

    const candidate = scanInactive(issue, 60, snapshot.generated);

    assert.equal(candidate.number, 500);
    assert.match(candidate.reason, /inactive|stale/i);
    assert.match(candidate.reason, /243 days/);
    assert.match(candidate.reason, /threshold \(60\)/);
    assert.equal(candidate.suggested_action, "close");
    assert.deepEqual(candidate.evidence, {
      updatedAt: "2025-12-01T00:00:00.000Z",
      generated: "2026-08-01T00:00:00.000Z",
      daysSinceUpdate: 243,
      thresholdDays: 60,
      milestone: null,
      labels: [],
    });
  });

  it("skips inactive old issues when a milestone is assigned", () => {
    const snapshot = loadFixtureSnapshot();
    const issue = snapshot.issues.find((entry) => entry.number === 501);

    assert.equal(scanInactive(issue, 60, snapshot.generated), null);
  });

  it("skips fresh issues even when milestone is null", () => {
    const snapshot = loadFixtureSnapshot();
    const issue = snapshot.issues.find((entry) => entry.number === 502);

    assert.equal(scanInactive(issue, 60, snapshot.generated), null);
  });
});

describe("scanWontfixInvalid", () => {
  it("surfaces wontfix with a label-specific reason", () => {
    const snapshot = loadFixtureSnapshot();
    const issue = snapshot.issues.find((entry) => entry.number === 503);

    const [candidate] = scanWontfixInvalid(issue);

    assert.equal(candidate.number, 503);
    assert.match(candidate.reason, /wontfix/i);
    assert.equal(candidate.suggested_action, "close");
    assert.equal(candidate.evidence.matchedLabel, "wontfix");
  });

  it("surfaces invalid with a label-specific reason", () => {
    const snapshot = loadFixtureSnapshot();
    const issue = snapshot.issues.find((entry) => entry.number === 504);

    const [candidate] = scanWontfixInvalid(issue);

    assert.equal(candidate.number, 504);
    assert.match(candidate.reason, /invalid/i);
    assert.equal(candidate.suggested_action, "close");
    assert.equal(candidate.evidence.matchedLabel, "invalid");
  });

});

describe("resolveThresholdDays and analyzeSnapshot", () => {
  let tempBacklogDir;

  beforeEach(() => {
    tempBacklogDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-stale-config-"));
  });

  afterEach(() => {
    fs.rmSync(tempBacklogDir, { recursive: true, force: true });
  });

  it("reads stale_days from triage config when --since is absent", () => {
    fs.writeFileSync(
      path.join(tempBacklogDir, "triage-config.yml"),
      ["theme_keywords:", "activity_days:", "  warm: 14", "  cold: 60", "stale_days: 10", ""].join("\n")
    );

    assert.equal(resolveThresholdDays({ backlogDir: tempBacklogDir }), 10);
  });

  it("lets --since override stale_days from triage config", () => {
    fs.writeFileSync(path.join(tempBacklogDir, "triage-config.yml"), "stale_days: 10\n");
    assert.equal(resolveThresholdDays({ since: 9999, backlogDir: tempBacklogDir }), 9999);
  });

  it("falls back to the default stale_days when config is malformed", () => {
    fs.writeFileSync(path.join(tempBacklogDir, "triage-config.yml"), "stale_days: nope\n");
    assert.equal(resolveThresholdDays({ backlogDir: tempBacklogDir }), DEFAULT_STALE_DAYS);
  });

  it("analyzeSnapshot flags inactive stale/old #500 but not fresh #502 and respects milestone #501", () => {
    const result = analyzeSnapshot(loadFixtureSnapshot(), {
      config: {
        stale_days: 60,
      },
    });

    const numbers = result.candidates.map((candidate) => candidate.number);
    const inactiveCandidates = result.candidates.filter((candidate) => /inactive|stale|old/i.test(candidate.reason));

    assert.ok(numbers.includes(500));
    assert.ok(numbers.includes(503));
    assert.ok(numbers.includes(504));
    assert.ok(!inactiveCandidates.some((candidate) => candidate.number === 501));
    assert.ok(!numbers.includes(502));
  });
});
