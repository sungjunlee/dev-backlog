const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseArgs,
  parseRepoFromRemoteUrl,
  classifyIssue,
  collectSnapshot,
  formatSnapshotFilename,
} = require("./triage-collect.js");

const GENERATED = "2026-04-18T01:30:00.000Z";
const CONFIG = {
  theme_keywords: {
    auth: ["auth", "oauth", "token"],
    docs: ["docs", "readme"],
  },
  activity_days: {
    warm: 14,
    cold: 60,
  },
  stale_days: 60,
  duplicate_threshold: 0.75,
};

function makeIssue(overrides = {}) {
  return {
    number: 61,
    title: "feat(backlog-triage): collect + classify open issues",
    labels: [],
    createdAt: "2026-04-17T01:30:00.000Z",
    updatedAt: "2026-04-17T01:30:00.000Z",
    milestone: null,
    ...overrides,
  };
}

describe("parseArgs", () => {
  it("parses repo, limit, json, and dry-run flags", () => {
    assert.deepEqual(parseArgs(["--repo", "owner/repo", "--limit", "3", "--json", "--dry-run"]), {
      repo: "owner/repo",
      limit: 3,
      json: true,
      dryRun: true,
    });
  });

  it("rejects invalid repo and limit values", () => {
    assert.equal(parseArgs(["--repo"]).error, "Missing value for --repo. Expected OWNER/REPO.");
    assert.equal(parseArgs(["--repo", "invalid"]).error, "Invalid --repo value: invalid. Expected OWNER/REPO.");
    assert.equal(parseArgs(["--limit", "0"]).error, "Invalid --limit value: 0. Expected a positive integer.");
  });
});

describe("parseRepoFromRemoteUrl", () => {
  it("supports SSH and HTTPS GitHub remotes", () => {
    assert.equal(parseRepoFromRemoteUrl("git@github.com:sungjunlee/dev-backlog.git"), "sungjunlee/dev-backlog");
    assert.equal(
      parseRepoFromRemoteUrl("https://github.com/sungjunlee/dev-backlog.git"),
      "sungjunlee/dev-backlog"
    );
  });
});

describe("classifyIssue", () => {
  it("spec row age boundary: exactly 7d old issues bucket as 7-30d", () => {
    const issue = classifyIssue(makeIssue({ createdAt: "2026-04-11T01:30:00.000Z" }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(issue.buckets.age, "7-30d");
  });

  it("spec row age boundary: exactly 30d old issues bucket as 30-90d", () => {
    const issue = classifyIssue(makeIssue({ createdAt: "2026-03-19T01:30:00.000Z" }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(issue.buckets.age, "30-90d");
  });

  it("spec row age boundary: exactly 90d old issues bucket as >90d", () => {
    const issue = classifyIssue(makeIssue({ createdAt: "2026-01-18T01:30:00.000Z" }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(issue.buckets.age, ">90d");
  });

  it("spec row activity boundary: exactly 14d stale issues bucket as warm", () => {
    const issue = classifyIssue(makeIssue({ updatedAt: "2026-04-04T01:30:00.000Z" }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(issue.buckets.activity, "warm");
  });

  it("spec row activity boundary: exactly 60d stale issues bucket as cold", () => {
    const issue = classifyIssue(makeIssue({ updatedAt: "2026-02-17T01:30:00.000Z" }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(issue.buckets.activity, "cold");
  });

  it("spec row theme matching: picks the configured theme from title keywords", () => {
    const issue = classifyIssue(makeIssue({ title: "OAuth token refresh flow" }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(issue.buckets.theme, "auth");
  });

  it("spec row theme fallback: uses uncategorized when there is no keyword match", () => {
    const issue = classifyIssue(makeIssue({ title: "Improve sprint batching notes" }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(issue.buckets.theme, "uncategorized");
  });

  it("spec row theme fallback: empty theme config still returns uncategorized", () => {
    const issue = classifyIssue(makeIssue({ title: "OAuth token refresh flow" }), {
      generated: GENERATED,
      config: { ...CONFIG, theme_keywords: {} },
    });
    assert.equal(issue.buckets.theme, "uncategorized");
  });

  it("spec row milestone bucket: null milestone becomes unassigned", () => {
    const issue = classifyIssue(makeIssue({ milestone: null }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(issue.buckets.milestone, "unassigned");
    assert.equal(issue.milestone, null);
  });

  it("spec row milestone bucket: populated milestone becomes assigned", () => {
    const issue = classifyIssue(
      makeIssue({ milestone: { title: "Backlog Triage MVP" } }),
      {
        generated: GENERATED,
        config: CONFIG,
      }
    );
    assert.equal(issue.buckets.milestone, "assigned");
    assert.equal(issue.milestone, "Backlog Triage MVP");
  });

  it("spec row empty labels: empty label sets keep safe defaults", () => {
    const issue = classifyIssue(makeIssue({ labels: [] }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.deepEqual(issue.buckets.label, {
      type: "uncategorized",
      priority: "medium",
      status: "todo",
    });
  });

  it("spec row label buckets: type, priority, and status reuse the label scheme", () => {
    const issue = classifyIssue(
      makeIssue({
        labels: [{ name: "type:feature" }, { name: "priority:high" }, { name: "status:in-progress" }],
      }),
      {
        generated: GENERATED,
        config: CONFIG,
      }
    );
    assert.deepEqual(issue.buckets.label, {
      type: "feature",
      priority: "high",
      status: "in-progress",
    });
  });
});

describe("collectSnapshot", () => {
  let snapshotDir;

  beforeEach(() => {
    snapshotDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-collect-test-"));
  });

  afterEach(() => {
    fs.rmSync(snapshotDir, { recursive: true, force: true });
  });

  it("writes a canonical snapshot with an FS-safe filename", () => {
    const execFile = () =>
      JSON.stringify([
        makeIssue({
          number: 61,
          title: "OAuth token refresh flow",
          labels: [{ name: "type:feature" }],
        }),
      ]);

    const result = collectSnapshot({
      repo: "sungjunlee/dev-backlog",
      limit: 1,
      execFile,
      config: CONFIG,
      generated: GENERATED,
      snapshotDir,
    });

    const expectedPath = path.join(snapshotDir, "2026-04-18T01-30-00Z.json");
    assert.equal(result.snapshotPath, expectedPath);
    assert.equal(formatSnapshotFilename(GENERATED), "2026-04-18T01-30-00Z.json");
    assert.equal(fs.existsSync(expectedPath), true);

    const written = JSON.parse(fs.readFileSync(expectedPath, "utf-8"));
    assert.equal(written.repo, "sungjunlee/dev-backlog");
    assert.equal(written.config_path, "backlog/triage-config.yml");
    assert.equal(written.issues.length, 1);
  });

  it("honors dry-run by skipping all snapshot writes", () => {
    const execFile = () => JSON.stringify([makeIssue()]);

    const result = collectSnapshot({
      repo: "sungjunlee/dev-backlog",
      limit: 1,
      dryRun: true,
      execFile,
      config: CONFIG,
      generated: GENERATED,
      snapshotDir,
    });

    assert.equal(result.snapshotPath, null);
    assert.deepEqual(fs.readdirSync(snapshotDir), []);
  });

  it("detects the default repo from git remote get-url origin when --repo is omitted", () => {
    const calls = [];
    const execFile = (command, args) => {
      calls.push({ command, args });
      if (command === "git") return "git@github.com:sungjunlee/dev-backlog.git\n";
      if (command === "gh") return JSON.stringify([makeIssue()]);
      throw new Error(`Unexpected command: ${command}`);
    };

    const result = collectSnapshot({
      limit: 1,
      dryRun: true,
      execFile,
      config: CONFIG,
      generated: GENERATED,
      snapshotDir,
    });

    assert.equal(result.snapshot.repo, "sungjunlee/dev-backlog");
    assert.equal(calls[0].command, "git");
    assert.deepEqual(calls[1], {
      command: "gh",
      args: [
        "issue",
        "list",
        "--state",
        "open",
        "--limit",
        "1",
        "--repo",
        "sungjunlee/dev-backlog",
        "--json",
        "number,title,body,labels,milestone,assignees,createdAt,updatedAt",
      ],
    });
  });
});
