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
  TRIAGE_DEFAULT_FETCH_LIMIT,
} = require("./triage-collect.js");

const GENERATED = "2026-04-18T01:30:00.000Z";
const FIXTURE_PATH = path.join(__dirname, "__fixtures__", "triage-collect", "open-issues.json");
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

function loadFixtureIssues() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf-8"));
}

function makeIssue(overrides = {}) {
  return {
    number: 61,
    title: "feat(backlog-triage): collect + classify open issues",
    body: "Issue body",
    labels: [],
    createdAt: "2026-04-17T01:30:00.000Z",
    updatedAt: "2026-04-17T01:30:00.000Z",
    milestone: null,
    closing_prs: [],
    ...overrides,
  };
}

function toGraphqlOpenIssue(issue) {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    milestone: issue.milestone,
    labels: {
      nodes: (issue.labels || []).map((label) => (
        typeof label === "string" ? { name: label } : { name: label.name }
      )),
    },
    closedByPullRequestsReferences: {
      nodes: (issue.closing_prs || []).map((pr) => ({
        number: pr.number,
        state: pr.state,
        mergedAt: pr.mergedAt || null,
        url: pr.url || null,
      })),
    },
  };
}

function openIssuesPage(issues, pageInfo = { hasNextPage: false, endCursor: null }) {
  return JSON.stringify({
    data: {
      repository: {
        issues: {
          nodes: issues.map(toGraphqlOpenIssue),
          pageInfo,
        },
      },
    },
  });
}

function closedIssuesPage(issues, pageInfo = { hasNextPage: false, endCursor: null }) {
  return JSON.stringify({
    data: {
      search: {
        nodes: issues,
        pageInfo,
      },
    },
  });
}

describe("parseArgs", () => {
  it("parses repo, limit, comment/closed flags, json, and dry-run flags", () => {
    assert.deepEqual(
      parseArgs([
        "--repo",
        "owner/repo",
        "--limit",
        "3",
        "--with-comments",
        "--with-closed-issues",
        "--json",
        "--dry-run",
      ]),
      {
        repo: "owner/repo",
        limit: 3,
        withComments: true,
        withClosedIssues: true,
        json: true,
        dryRun: true,
      }
    );
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

  it("passes through a populated body for downstream consumers (#62/#63 body-scan signals)", () => {
    const body = "Blocks #42\n\nSee https://example.com for context.";
    const issue = classifyIssue(makeIssue({ body }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(issue.body, body);
  });

  it("emits empty-string body when gh returns undefined or null (never undefined in snapshot)", () => {
    const withoutBody = classifyIssue(makeIssue({ body: undefined }), {
      generated: GENERATED,
      config: CONFIG,
    });
    const nullBody = classifyIssue(makeIssue({ body: null }), {
      generated: GENERATED,
      config: CONFIG,
    });
    assert.equal(withoutBody.body, "");
    assert.equal(nullBody.body, "");
  });

  it("preserves closing_prs and comments for downstream snapshot v2 consumers", () => {
    const comments = [{ author: "octocat", body: "Tracked in #73", createdAt: GENERATED }];
    const closingPrs = [{ number: 120, state: "MERGED", mergedAt: GENERATED, url: "https://example.com/pr/120" }];
    const issue = classifyIssue(makeIssue({ closing_prs: closingPrs, comments }), {
      generated: GENERATED,
      config: CONFIG,
    });

    assert.deepEqual(issue.closing_prs, closingPrs);
    assert.deepEqual(issue.comments, comments);
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

  it("writes a canonical snapshot with an FS-safe filename", async () => {
    const calls = [];
    const execFile = (command, args) => {
      calls.push({ command, args });
      return openIssuesPage([
        makeIssue({
          number: 61,
          title: "OAuth token refresh flow",
          labels: [{ name: "type:feature" }],
        }),
      ]);
    };

    const result = await collectSnapshot({
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
    assert.deepEqual(written.issues[0].closing_prs, []);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "gh");
    assert.deepEqual(calls[0].args.slice(0, 8), [
      "api",
      "graphql",
      "-F",
      "owner=sungjunlee",
      "-F",
      "name=dev-backlog",
      "-F",
      "pageSize=1",
    ]);
    assert.equal(calls[0].args[8], "-f");
    assert.match(calls[0].args[9], /^query=\s*query\(/);
  });

  it("honors dry-run by skipping all snapshot writes", async () => {
    const execFile = () => openIssuesPage([makeIssue()]);

    const result = await collectSnapshot({
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

  it("excludes dev-backlog progress issues from the snapshot", async () => {
    const execFile = () => openIssuesPage(loadFixtureIssues());

    const result = await collectSnapshot({
      repo: "sungjunlee/dev-backlog",
      dryRun: true,
      execFile,
      config: CONFIG,
      generated: GENERATED,
      snapshotDir,
    });

    assert.deepEqual(
      result.snapshot.issues.map((issue) => issue.number),
      [79]
    );
    assert.equal(result.snapshot.issues[0].title, "fix(backlog-triage): preserve conventional commit prefixes in report titles");
  });

  it("detects the default repo from git remote get-url origin when --repo is omitted", async () => {
    const calls = [];
    const execFile = (command, args) => {
      calls.push({ command, args });
      if (command === "git") return "git@github.com:sungjunlee/dev-backlog.git\n";
      if (command === "gh") return openIssuesPage([makeIssue()]);
      throw new Error(`Unexpected command: ${command}`);
    };

    const result = await collectSnapshot({
      limit: 1,
      dryRun: true,
      execFile,
      config: CONFIG,
      generated: GENERATED,
      snapshotDir,
    });

    assert.equal(result.snapshot.repo, "sungjunlee/dev-backlog");
    assert.equal(calls[0].command, "git");
    assert.deepEqual(calls[0].args, ["remote", "get-url", "origin"]);
    assert.equal(calls[1].command, "gh");
    assert.equal(calls[1].args[0], "api");
    assert.equal(calls[1].args[1], "graphql");
    assert.ok(calls[1].args.includes("owner=sungjunlee"));
    assert.ok(calls[1].args.includes("name=dev-backlog"));
    assert.ok(calls[1].args.includes("pageSize=1"));
    assert.equal(calls[1].args.includes("--paginate"), false);
  });

  it("uses a single paginated gh graphql fetch when --limit is omitted", async () => {
    const calls = [];
    const execFile = (command, args) => {
      calls.push({ command, args });
      if (command === "gh") return openIssuesPage([makeIssue()]);
      throw new Error(`Unexpected command: ${command}`);
    };

    const result = await collectSnapshot({
      repo: "sungjunlee/dev-backlog",
      dryRun: true,
      execFile,
      config: CONFIG,
      generated: GENERATED,
      snapshotDir,
    });

    assert.equal(result.snapshot.issues.length, 1);
    assert.equal(TRIAGE_DEFAULT_FETCH_LIMIT, 2147483647);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, "gh");
    assert.deepEqual(calls[0].args.slice(0, 8), [
      "api",
      "graphql",
      "-F",
      "owner=sungjunlee",
      "-F",
      "name=dev-backlog",
      "-F",
      "pageSize=100",
    ]);
    assert.equal(calls[0].args[8], "-f");
    assert.match(calls[0].args[9], /^query=\s*query\(/);
    assert.equal(calls[0].args[10], "--paginate");
  });

  it("adds normalized comments only when --with-comments is enabled", async () => {
    const calls = [];
    const execFile = (command, args) => {
      calls.push({ command, args });
      if (command !== "gh") throw new Error(`Unexpected command: ${command}`);

      if (args[0] === "api" && args[1] === "graphql") {
        return openIssuesPage([
          makeIssue({ number: 61 }),
          makeIssue({
            number: 78,
            title: "Progress: April 2026",
            body: "<!-- dev-backlog:progress-issue month=2026-04 -->",
          }),
        ]);
      }

      if (args[0] === "api" && args[1] === "repos/sungjunlee/dev-backlog/issues/61/comments") {
        return JSON.stringify([
          {
            user: { login: "octocat" },
            body: "Looks good",
            created_at: GENERATED,
          },
        ]);
      }

      throw new Error(`Unexpected gh args: ${args.join(" ")}`);
    };

    const result = await collectSnapshot({
      repo: "sungjunlee/dev-backlog",
      dryRun: true,
      withComments: true,
      execFile,
      config: { ...CONFIG, comment_fetch_concurrency: 3 },
      generated: GENERATED,
      snapshotDir,
    });

    assert.deepEqual(result.snapshot.issues, [
      {
        number: 61,
        title: "feat(backlog-triage): collect + classify open issues",
        body: "Issue body",
        labels: [],
        createdAt: "2026-04-17T01:30:00.000Z",
        updatedAt: "2026-04-17T01:30:00.000Z",
        milestone: null,
        closing_prs: [],
        comments: [{ author: "octocat", body: "Looks good", createdAt: GENERATED }],
        buckets: {
          label: { type: "uncategorized", priority: "medium", status: "todo" },
          theme: "uncategorized",
          age: "<7d",
          activity: "recent",
          milestone: "unassigned",
        },
      },
    ]);
    assert.deepEqual(result.warnings, [
      "--with-comments enabled: fetching issue comments adds 1 gh API calls (concurrency 3).",
    ]);
    assert.equal(
      calls.filter((call) => call.args[1] === "repos/sungjunlee/dev-backlog/issues/61/comments").length,
      1
    );
    assert.equal(
      calls.some((call) => call.args[1] === "repos/sungjunlee/dev-backlog/issues/78/comments"),
      false
    );
  });

  it("adds top-level closed_issues only when --with-closed-issues is enabled", async () => {
    const calls = [];
    const execFile = (command, args) => {
      calls.push({ command, args });
      if (command !== "gh") throw new Error(`Unexpected command: ${command}`);

      if (args[0] === "api" && args[1] === "graphql" && args.includes("owner=sungjunlee")) {
        return openIssuesPage([makeIssue()]);
      }

      if (args[0] === "api" && args[1] === "graphql" && args.some((arg) => arg.startsWith("searchQuery="))) {
        return closedIssuesPage([
          {
            number: 55,
            title: "Old triage follow-up",
            body: "Closed via follow-up PR",
            closedAt: "2026-04-10T00:00:00Z",
          },
        ]);
      }

      throw new Error(`Unexpected gh args: ${args.join(" ")}`);
    };

    const result = await collectSnapshot({
      repo: "sungjunlee/dev-backlog",
      dryRun: true,
      withClosedIssues: true,
      execFile,
      config: {
        ...CONFIG,
        closed_issue_days: 30,
        closed_issue_limit: 2,
      },
      generated: GENERATED,
      snapshotDir,
    });

    assert.deepEqual(result.snapshot.closed_issues, [
      {
        number: 55,
        title: "Old triage follow-up",
        body: "Closed via follow-up PR",
        closedAt: "2026-04-10T00:00:00Z",
      },
    ]);

    const searchCall = calls.find((call) => call.args.some((arg) => arg.startsWith("searchQuery=")));
    assert.ok(searchCall);
    assert.ok(
      searchCall.args.includes("searchQuery=repo:sungjunlee/dev-backlog is:issue is:closed closed:>=2026-03-19")
    );
    assert.ok(searchCall.args.includes("pageSize=2"));
    assert.equal(searchCall.args.includes("--paginate"), false);
  });
});
