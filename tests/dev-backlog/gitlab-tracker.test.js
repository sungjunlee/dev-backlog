const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  TRACKER_ADAPTERS,
  createGitlabAdapter,
  resolveConfiguredTracker,
  resolveTracker,
  validateAdapter,
  validateIdentity,
} = require(path.join(SKILL_SCRIPTS, "tracker.js"));
const {
  GLAB_EXEC_DEFAULTS,
  gitlabIdentity,
  normalizeGitlabTask,
} = require(path.join(SKILL_SCRIPTS, "gitlab-tracker.js"));
const { writeGlabFixture } = require(path.join(SKILL_SCRIPTS, "fake-glab-fixture.js"));

function recordingExec(responses) {
  const calls = [];
  const execFile = (command, args, options) => {
    calls.push({ command, args, options });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return response;
  };
  return { calls, execFile };
}

function enoent(message = "spawn glab ENOENT") {
  const error = new Error(message);
  error.code = "ENOENT";
  return error;
}

function gitlabIssue(overrides = {}) {
  return {
    id: 10007,
    iid: 7,
    title: "GitLab adapter",
    description: "body",
    state: "opened",
    labels: ["feature"],
    milestone: null,
    assignees: [],
    web_url: "https://gitlab.com/acme/widgets/-/issues/7",
    created_at: "2026-09-15T00:00:00Z",
    updated_at: "2026-09-15T00:00:00Z",
    ...overrides,
  };
}

function identityOf(task) {
  const identity = {
    tracker: task.tracker,
    id: task.id,
    ref: task.ref,
  };
  if (task.url !== undefined) identity.url = task.url;
  return identity;
}

describe("GitLab required lifecycle adapter", () => {
  it("has exactly the required shape and under-claims capabilities", () => {
    const adapter = createGitlabAdapter({ execFile: () => "glab 1.53.0\n" });

    assert.deepEqual(Object.keys(adapter), [
      "availability",
      "capabilities",
      "list",
      "read",
      "create",
      "update",
      "close",
    ]);
    assert.equal(validateAdapter("gitlab", adapter), adapter);
    assert.deepEqual(adapter.availability(), { available: true });
    assert.deepEqual(adapter.capabilities(), ["comments", "closing-semantics"]);
    assert.equal(adapter.capabilities().includes("pull-request-relationships"), false);
    assert.equal(adapter.capabilities().includes("milestones"), false);
  });

  it("reports available:false with a reason when the CLI is missing (never throws)", () => {
    const adapter = createGitlabAdapter({ execFile: () => { throw enoent(); } });
    const report = adapter.availability();
    assert.equal(report.available, false);
    assert.match(report.reason, /ENOENT/);
    assert.match(report.reason, /glab/);
  });

  it("reports available:false when auth status fails", () => {
    const adapter = createGitlabAdapter({
      execFile: (command, args) => {
        if (args[0] === "version") return "glab 1.53.0\n";
        throw new Error("HTTP 401: authentication required");
      },
    });
    const report = adapter.availability();
    assert.equal(report.available, false);
    assert.match(report.reason, /not authenticated|401/);
  });

  it("lists open tasks through glab JSON and normalizes gitlab#N identities", () => {
    const listed = [gitlabIssue()];
    const { calls, execFile } = recordingExec([JSON.stringify(listed)]);
    const adapter = createGitlabAdapter({ execFile });

    const tasks = adapter.list({ state: "open", limit: 20, repo: "acme/widgets" });

    assert.deepEqual(calls, [{
      command: "glab",
      args: [
        "issue", "list", "--output", "json", "--per-page", "20",
        "--repo", "acme/widgets",
      ],
      options: GLAB_EXEC_DEFAULTS,
    }]);
    assert.deepEqual(identityOf(tasks[0]), {
      tracker: "gitlab",
      id: "7",
      ref: "gitlab#7",
      url: listed[0].web_url,
    });
    assert.equal(tasks[0].title, "GitLab adapter");
    assert.equal(tasks[0].body, "body");
    assert.equal(tasks[0].state, "open");
    assert.deepEqual(validateIdentity(identityOf(tasks[0])), identityOf(tasks[0]));
  });

  it("maps closed list state to --closed and keeps --all intact", () => {
    const listed = [gitlabIssue({ state: "closed" })];
    const { calls, execFile } = recordingExec([
      JSON.stringify(listed),
      JSON.stringify(listed),
    ]);
    const adapter = createGitlabAdapter({ execFile });

    adapter.list({ state: "closed" });
    assert.deepEqual(calls[0].args, ["issue", "list", "--closed", "--output", "json"]);

    adapter.list({ state: "all" });
    assert.deepEqual(calls[1].args, ["issue", "list", "--all", "--output", "json"]);
  });

  it("reads one task with comments and a normalized identity", () => {
    const issue = gitlabIssue({
      notes: [{ id: 1, body: "## Agent Brief\nDo this." }],
    });
    const { calls, execFile } = recordingExec([JSON.stringify(issue)]);
    const adapter = createGitlabAdapter({ execFile });

    const task = adapter.read(
      { tracker: "gitlab", id: "7", ref: "gitlab#7" },
      { repo: "acme/widgets" },
    );

    assert.deepEqual(calls, [{
      command: "glab",
      args: [
        "issue", "view", "7", "--comments", "--output", "json",
        "--repo", "acme/widgets",
      ],
      options: GLAB_EXEC_DEFAULTS,
    }]);
    assert.equal(task.tracker, "gitlab");
    assert.equal(task.id, "7");
    assert.equal(task.ref, "gitlab#7");
    assert.equal(task.body, "body");
    assert.equal(task.comments[0].body, "## Agent Brief\nDo this.");
  });

  it("creates, updates, and closes through injected execution with gitlab#N identity", () => {
    const url = "https://gitlab.com/acme/widgets/-/issues/42";
    const { calls, execFile } = recordingExec([`${url}\n`, "", ""]);
    const adapter = createGitlabAdapter({ execFile });

    const created = adapter.create({
      title: "Ship GitLab adapter",
      body: "glab only",
      repo: "acme/widgets",
    });
    const updated = adapter.update(created, {
      title: "Ship GitLab adapter",
      body: "glab only, fail-closed",
      repo: "acme/widgets",
    });
    const closed = adapter.close(updated, { repo: "acme/widgets" });

    assert.deepEqual(calls, [
      {
        command: "glab",
        args: [
          "issue", "create", "--title", "Ship GitLab adapter",
          "--description", "glab only", "--yes", "--no-editor",
          "--repo", "acme/widgets",
        ],
        options: GLAB_EXEC_DEFAULTS,
      },
      {
        command: "glab",
        args: [
          "issue", "update", "42", "--title", "Ship GitLab adapter",
          "--description", "glab only, fail-closed", "--repo", "acme/widgets",
        ],
        options: GLAB_EXEC_DEFAULTS,
      },
      {
        command: "glab",
        args: ["issue", "close", "42", "--repo", "acme/widgets"],
        options: GLAB_EXEC_DEFAULTS,
      },
    ]);
    const identity = { tracker: "gitlab", id: "42", ref: "gitlab#42", url };
    assert.deepEqual(created, identity);
    assert.deepEqual(updated, identity);
    assert.deepEqual(closed, identity);
  });

  it("fails closed on malformed JSON instead of inventing tasks", () => {
    const { execFile } = recordingExec(["not-json"]);
    const adapter = createGitlabAdapter({ execFile });
    assert.throws(() => adapter.list(), /expected JSON/);
  });

  it("propagates configured GitLab transport failure without consulting GitHub or files", () => {
    const { execFile } = recordingExec([
      "glab 1.53.0\n",
      "ok\n",
      new Error("glab transport failed"),
    ]);
    const gitlab = createGitlabAdapter({
      execFile: (command, args, options) => {
        if (command !== "glab") throw new Error("must not call another provider");
        return execFile(command, args, options);
      },
    });
    const resolved = resolveTracker({ tracker: "gitlab" }, {
      adapters: {
        gitlab,
        github: TRACKER_ADAPTERS.github,
        files: TRACKER_ADAPTERS.files,
      },
    });

    assert.throws(() => resolved.adapter.list({ limit: 1 }), /glab transport failed/);
  });
});

describe("GitLab identity helpers", () => {
  it("accepts IIDs and gitlab#N refs and rejects malformed values", () => {
    assert.deepEqual(gitlabIdentity("12"), { tracker: "gitlab", id: "12", ref: "gitlab#12" });
    assert.deepEqual(gitlabIdentity("gitlab#12"), { tracker: "gitlab", id: "12", ref: "gitlab#12" });
    assert.throws(() => gitlabIdentity("0"), /Invalid GitLab issue IID/);
    assert.throws(
      () => normalizeGitlabTask({ iid: 1, web_url: "not-a-url" }),
      /Invalid GitLab issue URL/,
    );
  });
});

describe("GitLab adapter fake-glab acceptance", () => {
  it("runs list → create → update → close without a real CLI", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-fake-cycle-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const fixture = writeGlabFixture(root);
    const execFile = (command, args, options = {}) => {
      assert.equal(command, "glab");
      return execFileSync(process.execPath, [fixture.glabPath, ...args], {
        ...options,
        env: { ...fixture.env, ...(options.env || {}) },
      });
    };
    const adapter = createGitlabAdapter({ execFile });

    assert.deepEqual(adapter.availability(), { available: true });
    assert.deepEqual(adapter.list(), []);

    const created = adapter.create({ title: "Cycle task", body: "via glab" });
    assert.deepEqual(created, {
      tracker: "gitlab",
      id: "12",
      ref: "gitlab#12",
      url: "https://gitlab.test/acme/widgets/-/issues/12",
    });

    const listed = adapter.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].ref, "gitlab#12");
    assert.equal(listed[0].title, "Cycle task");

    adapter.update(created, { title: "Cycle task renamed" });
    const read = adapter.read(created);
    assert.equal(read.title, "Cycle task renamed");
    assert.equal(read.state, "open");
    assert.equal(read.body, "via glab");

    adapter.close(created);
    assert.equal(adapter.read(created).state, "closed");
    assert.equal(fixture.state().issues[0].state, "closed");
  });

  it("is unavailable when PATH has no glab binary", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-missing-cli-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const emptyBin = path.join(root, "empty-bin");
    fs.mkdirSync(emptyBin);
    const adapter = createGitlabAdapter({
      execFile: (command, args, options = {}) => execFileSync(command, args, {
        ...options,
        env: { ...process.env, PATH: emptyBin },
      }),
    });
    const report = adapter.availability();
    assert.equal(report.available, false);
    assert.match(report.reason, /ENOENT|not found|glab/i);
  });

  it("injects auth-expired and http-502 without mutating issue state", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "gitlab-fail-inject-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const fixture = writeGlabFixture(root);
    const execFile = (command, args, options = {}) => {
      assert.equal(command, "glab");
      return execFileSync(process.execPath, [fixture.glabPath, ...args], {
        ...options,
        env: { ...fixture.env, ...(options.env || {}) },
      });
    };
    const created = createGitlabAdapter({ execFile }).create({ title: "Keep" });
    assert.equal(fixture.state().issues.length, 1);

    for (const fail of ["auth-expired", "http-502"]) {
      const failing = createGitlabAdapter({
        execFile: (command, args, options = {}) => execFileSync(
          process.execPath,
          [fixture.glabPath, ...args],
          {
            ...options,
            env: { ...fixture.env, FAKE_GLAB_FAIL: fail, ...(options.env || {}) },
          },
        ),
      });
      const report = failing.availability();
      assert.equal(report.available, false);
      assert.throws(() => failing.update(created, { title: "must not stick" }));
    }
    assert.equal(fixture.state().issues[0].title, "Keep");
  });

  it("injects execFile for the gitlab adapter through resolveConfiguredTracker", () => {
    const { execFile } = recordingExec(["glab 1.53.0\n", "ok\n"]);
    const resolved = resolveConfiguredTracker({ tracker: "gitlab" }, { execFile });
    assert.equal(resolved.tracker, "gitlab");
    assert.deepEqual(resolved.availability, { available: true });
  });
});
