const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseArgs,
  extractIssueRefs,
  scanMentions,
  scanBlocks,
  scanDependsOn,
  findDuplicateCandidates,
  analyzeSnapshot,
  readSnapshotFile,
} = require("./triage-relate.js");

function makeSnapshot(overrides = {}) {
  return {
    generated: "2026-04-18T05:00:00.000Z",
    repo: "sungjunlee/dev-backlog",
    config_path: "backlog/triage-config.yml",
    issues: [],
    ...overrides,
  };
}

function makeIssue(overrides = {}) {
  return {
    number: 100,
    title: "OAuth token refresh flow",
    body: "",
    labels: [],
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-17T00:00:00.000Z",
    milestone: null,
    buckets: {
      label: { type: "feature", priority: "medium", status: "todo" },
      theme: "auth",
      age: "7-30d",
      activity: "recent",
      milestone: "unassigned",
    },
    ...overrides,
  };
}

describe("parseArgs", () => {
  it("parses snapshot and json flags", () => {
    assert.deepEqual(parseArgs(["--snapshot", "tmp.json", "--json"]), {
      snapshotPath: "tmp.json",
      json: true,
    });
  });

  it("rejects missing snapshot paths", () => {
    assert.match(parseArgs([]).error, /--snapshot/);
    assert.match(parseArgs(["--snapshot"]).error, /--snapshot/);
  });
});

describe("extractIssueRefs", () => {
  it("ignores fenced code blocks and URL fragments", () => {
    const refs = extractIssueRefs([
      "See #101 for the follow-up.",
      "```md",
      "Blocked by #102",
      "```",
      "Reference: https://github.com/owner/name/pull/123/files#diff-1",
      "Self note #100",
    ].join("\n"));

    assert.deepEqual(
      refs.map((ref) => ref.number),
      [101, 100]
    );
    assert.equal(refs[0].snippet, "See #101 for the follow-up.");
  });
});

describe("scanMentions", () => {
  it("mentions: emits body references and suppresses self/code/url noise", () => {
    const snapshot = makeSnapshot({
      issues: [
        makeIssue({
          number: 100,
          body: [
            "See also #101 before filing a follow-up.",
            "```js",
            "const hidden = '#102';",
            "```",
            "https://github.com/owner/name/pull/123/files#diff-1",
            "Reminder #100 should stay local.",
          ].join("\n"),
        }),
      ],
    });

    assert.deepEqual(scanMentions(snapshot), [
      {
        from: 100,
        to: 101,
        kind: "mentions",
        confidence: 0.75,
        evidence: {
          match: "#101",
          snippet: "See also #101 before filing a follow-up.",
        },
      },
    ]);
  });
});

describe("scanBlocks", () => {
  it("blocks: emits blocks and closes phrases with concrete evidence", () => {
    const snapshot = makeSnapshot({
      issues: [
        makeIssue({
          number: 100,
          body: "Blocks #101 until the token flow lands. Later it closes #102 cleanly.",
        }),
      ],
    });

    const edges = scanBlocks(snapshot);
    assert.deepEqual(
      edges.map((edge) => [edge.from, edge.to, edge.kind, edge.evidence.phrase]),
      [
        [100, 101, "blocks", "Blocks #101"],
        [100, 102, "blocks", "closes #102"],
      ]
    );
    assert.match(edges[0].evidence.snippet, /Blocks #101/);
    assert.match(edges[1].evidence.snippet, /closes #102/);
  });
});

describe("scanDependsOn", () => {
  it("depends-on: emits blocked by / depends on / depends-on phrases", () => {
    const snapshot = makeSnapshot({
      issues: [
        makeIssue({
          number: 101,
          body: "Blocked by #100 today. Then depends on #102 and depends-on #103 later.",
        }),
      ],
    });

    const edges = scanDependsOn(snapshot);
    assert.deepEqual(
      edges.map((edge) => [edge.from, edge.to, edge.kind, edge.evidence.phrase]),
      [
        [101, 100, "depends-on", "Blocked by #100"],
        [101, 102, "depends-on", "depends on #102"],
        [101, 103, "depends-on", "depends-on #103"],
      ]
    );
    assert.match(edges[0].evidence.snippet, /Blocked by #100/);
    assert.match(edges[1].evidence.snippet, /depends on #102/);
    assert.match(edges[2].evidence.snippet, /depends-on #103/);
  });
});

describe("findDuplicateCandidates", () => {
  it("duplicate-candidate: emits one canonical edge with overlap and score", () => {
    const snapshot = makeSnapshot({
      issues: [
        makeIssue({ number: 100, title: "OAuth token refresh flow" }),
        makeIssue({ number: 200, title: "OAuth token refresh flow redesign" }),
        makeIssue({ number: 300, title: "Add rate limiting to API endpoints" }),
      ],
    });

    assert.deepEqual(findDuplicateCandidates(snapshot, { duplicate_threshold: 0.75 }), [
      {
        from: 100,
        to: 200,
        kind: "duplicate-candidate",
        confidence: 0.8,
        evidence: {
          score: 0.8,
          overlap: ["flow", "oauth", "refresh", "token"],
          titles: {
            from: "OAuth token refresh flow",
            to: "OAuth token refresh flow redesign",
          },
        },
      },
    ]);
  });
});

describe("analyzeSnapshot", () => {
  let originalCwd;
  let tempDir;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-relate-test-"));
    fs.mkdirSync(path.join(tempDir, "backlog"), { recursive: true });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("honors backlog/triage-config.yml duplicate_threshold and sorts output", () => {
    process.chdir(tempDir);
    fs.writeFileSync(
      path.join(tempDir, "backlog", "triage-config.yml"),
      [
        "theme_keywords:",
        "  auth: [auth, oauth]",
        "activity_days:",
        "  warm: 14",
        "  cold: 60",
        "stale_days: 60",
        "duplicate_threshold: 0.99",
        "",
      ].join("\n")
    );

    const snapshot = makeSnapshot({
      issues: [
        makeIssue({
          number: 100,
          title: "OAuth token refresh flow",
          body: "Blocks #101. See also #200.",
        }),
        makeIssue({
          number: 101,
          title: "OAuth session persistence",
          body: "Depends on #100.",
        }),
        makeIssue({
          number: 200,
          title: "OAuth token refresh flow redesign",
          body: "Rewrite of the refresh flow.",
        }),
      ],
    });

    const strictEdges = analyzeSnapshot(snapshot);
    assert.equal(strictEdges.some((edge) => edge.kind === "duplicate-candidate"), false);

    fs.writeFileSync(
      path.join(tempDir, "backlog", "triage-config.yml"),
      [
        "theme_keywords:",
        "  auth: [auth, oauth]",
        "activity_days:",
        "  warm: 14",
        "  cold: 60",
        "stale_days: 60",
        "duplicate_threshold: 0.75",
        "",
      ].join("\n")
    );

    const looseEdges = analyzeSnapshot(snapshot);
    assert.deepEqual(
      looseEdges.map((edge) => [edge.from, edge.to, edge.kind]),
      [
        [100, 101, "blocks"],
        [100, 101, "mentions"],
        [100, 200, "duplicate-candidate"],
        [100, 200, "mentions"],
        [101, 100, "depends-on"],
        [101, 100, "mentions"],
      ]
    );
  });

  it("reads fixture snapshots from disk and errors on missing or malformed JSON", () => {
    process.chdir(tempDir);

    const snapshotPath = path.join(tempDir, "snapshot.json");
    fs.writeFileSync(snapshotPath, `${JSON.stringify(makeSnapshot({ issues: [makeIssue()] }), null, 2)}\n`);

    const snapshot = readSnapshotFile(snapshotPath);
    assert.equal(snapshot.issues[0].number, 100);

    assert.throws(
      () => readSnapshotFile(path.join(tempDir, "missing.json")),
      /Snapshot file is missing or unreadable/
    );

    const badPath = path.join(tempDir, "bad.json");
    fs.writeFileSync(badPath, "not json\n");
    assert.throws(() => readSnapshotFile(badPath), /Malformed snapshot JSON/);
  });
});
