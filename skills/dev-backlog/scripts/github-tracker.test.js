const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  CAPABILITY_NAMES,
  TRACKER_ADAPTERS,
  UnsupportedTrackerCapabilityError,
  createGithubAdapter,
  invokeCapability,
  resolveTracker,
} = require("./tracker.js");
const { GH_EXEC_DEFAULTS, OPEN_ISSUE_JSON_FIELDS } = require("./lib.js");

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

function identityOf(task) {
  const identity = {
    tracker: task.tracker,
    id: task.id,
    ref: task.ref,
  };
  if (task.url !== undefined) identity.url = task.url;
  return identity;
}

describe("GitHub required lifecycle adapter", () => {
  it("has exactly the required shape and reports the frozen capabilities", () => {
    const adapter = createGithubAdapter({ execFile: () => "" });

    assert.deepEqual(Object.keys(adapter), [
      "availability",
      "capabilities",
      "list",
      "read",
      "create",
      "update",
      "close",
    ]);
    assert.deepEqual(adapter.availability(), { available: true });
    assert.deepEqual(adapter.capabilities(), CAPABILITY_NAMES);
  });

  it("lists open tasks with legacy argv and additive normalized identities", () => {
    const github = [{
      number: 7,
      title: "Adapter boundary",
      body: "body",
      labels: [{ name: "feature" }],
      milestone: null,
      assignees: [],
      createdAt: "2026-07-10T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
      url: "https://github.com/acme/widgets/issues/7",
    }];
    const { calls, execFile } = recordingExec([JSON.stringify(github)]);
    const adapter = createGithubAdapter({ execFile });

    const tasks = adapter.list({ state: "open", limit: 12, repo: "acme/widgets" });

    assert.deepEqual(calls, [{
      command: "gh",
      args: [
        "issue", "list", "--state", "open", "--limit", "12",
        "--repo", "acme/widgets", "--json", OPEN_ISSUE_JSON_FIELDS,
      ],
      options: GH_EXEC_DEFAULTS,
    }]);
    assert.deepEqual(tasks[0], {
      ...github[0],
      tracker: "github",
      id: "7",
      ref: "#7",
    });
    assert.deepEqual(identityOf(tasks[0]), {
      tracker: "github",
      id: "7",
      ref: "#7",
      url: github[0].url,
    });
  });

  it("reads one task with exact argv and normalized identity", () => {
    const issue = {
      number: 7,
      title: "Adapter boundary",
      body: "body",
      labels: [],
      milestone: null,
      assignees: [],
      createdAt: "2026-07-10T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
      url: "https://github.com/acme/widgets/issues/7",
    };
    const { calls, execFile } = recordingExec([JSON.stringify(issue)]);
    const adapter = createGithubAdapter({ execFile });

    const task = adapter.read(
      { tracker: "github", id: "7", ref: "#7" },
      { repo: "acme/widgets" }
    );

    assert.deepEqual(calls, [{
      command: "gh",
      args: [
        "issue", "view", "7", "--repo", "acme/widgets",
        "--json", OPEN_ISSUE_JSON_FIELDS,
      ],
      options: GH_EXEC_DEFAULTS,
    }]);
    assert.deepEqual(task, {
      ...issue,
      tracker: "github",
      id: "7",
      ref: "#7",
    });
  });

  it("creates, updates, and closes through injected execution with stable results", () => {
    const url = "https://github.com/acme/widgets/issues/42";
    const { calls, execFile } = recordingExec([`${url}\n`, "", ""]);
    const adapter = createGithubAdapter({ execFile });

    const created = adapter.create({
      title: "Ship adapter",
      body: "Compatibility first",
      repo: "acme/widgets",
    });
    const updated = adapter.update(created, {
      title: "Ship GitHub adapter",
      body: "Compatibility preserved",
      repo: "acme/widgets",
    });
    const closed = adapter.close(updated, { repo: "acme/widgets" });

    assert.deepEqual(calls, [
      {
        command: "gh",
        args: [
          "issue", "create", "--title", "Ship adapter", "--body", "Compatibility first",
          "--repo", "acme/widgets",
        ],
        options: GH_EXEC_DEFAULTS,
      },
      {
        command: "gh",
        args: [
          "issue", "edit", "42", "--title", "Ship GitHub adapter",
          "--body", "Compatibility preserved", "--repo", "acme/widgets",
        ],
        options: GH_EXEC_DEFAULTS,
      },
      {
        command: "gh",
        args: ["issue", "close", "42", "--repo", "acme/widgets"],
        options: GH_EXEC_DEFAULTS,
      },
    ]);
    const identity = { tracker: "github", id: "42", ref: "#42", url };
    assert.deepEqual(created, identity);
    assert.deepEqual(updated, identity);
    assert.deepEqual(closed, identity);
  });

  it("resolves only the configured adapter and never falls back after transport failure", () => {
    let localReads = 0;
    const { execFile } = recordingExec([new Error("gh transport failed")]);
    const github = createGithubAdapter({ execFile });
    const local = {
      ...TRACKER_ADAPTERS.local,
      availability: () => {
        localReads += 1;
        return { available: true };
      },
    };
    const resolved = resolveTracker({ tracker: "github" }, { adapters: { github, local } });

    assert.throws(() => resolved.adapter.list({ limit: 1 }), /gh transport failed/);
    assert.equal(localReads, 0);
  });

  it("fails an unsupported capability before the supplied mutation", () => {
    let mutations = 0;
    const resolved = {
      tracker: "local",
      adapter: TRACKER_ADAPTERS.local,
    };

    assert.throws(
      () => invokeCapability(resolved, "mirrors", () => {
        mutations += 1;
      }),
      (error) => {
        assert.ok(error instanceof UnsupportedTrackerCapabilityError);
        assert.equal(error.tracker, "local");
        assert.equal(error.capability, "mirrors");
        return true;
      }
    );
    assert.equal(mutations, 0);
  });

  it("rejects malformed provider identities instead of leaking them to core callers", () => {
    const { execFile } = recordingExec([
      JSON.stringify([{ number: 7, title: "bad URL", url: "not-a-url" }]),
    ]);
    const adapter = createGithubAdapter({ execFile });
    assert.throws(() => adapter.list({ limit: 1 }), /Invalid GitHub issue URL/);
  });
});
