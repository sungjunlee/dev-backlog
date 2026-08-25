const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  CAPABILITY_NAMES,
  REQUIRED_ADAPTER_OPERATIONS,
  TRACKER_ADAPTERS,
  TrackerConfigurationError,
  TrackerContractError,
  TrackerIdentityError,
  TrackerUnavailableError,
  UnsupportedTrackerCapabilityError,
  invokeCapability,
  readCapabilities,
  readTrackerSelection,
  resolveConfiguredTracker,
  resolveTracker,
  selectTracker,
  serializeTrackerError,
  validateAdapter,
  validateIdentity,
  writeTrackerCliError,
} = require(path.join(SKILL_SCRIPTS, "tracker.js"));

function adapter(overrides = {}) {
  return {
    availability: () => ({ available: true }),
    capabilities: () => [...CAPABILITY_NAMES],
    list: () => [],
    read: () => ({}),
    create: (value) => value,
    update: (value) => value,
    close: (value) => value,
    ...overrides,
  };
}

describe("GitHub-only authority selection", () => {
  it("defaults to and explicitly accepts only github", () => {
    assert.equal(selectTracker(), "github");
    assert.equal(selectTracker({}), "github");
    assert.equal(selectTracker({ tracker: "github" }), "github");
    for (const value of ["local", "gitlab", "", 7, null]) {
      assert.throws(
        () => selectTracker({ tracker: value }),
        (error) => error instanceof TrackerConfigurationError && /expected one of: github/.test(error.message),
      );
    }
  });

  it("uses .tracker when present and rejects a retired local selection", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tracker-github-only-"));
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(backlogDir);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    assert.equal(readTrackerSelection(backlogDir), undefined);
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "github\n");
    assert.equal(resolveConfiguredTracker({}, { backlogDir, adapters: { github: adapter() } }).tracker, "github");
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "local\n");
    assert.throws(
      () => resolveConfiguredTracker({}, { backlogDir, adapters: { github: adapter() } }),
      /Invalid tracker configuration "local"/,
    );
  });

  it("never falls back when the GitHub adapter is unavailable", () => {
    const github = adapter({
      availability: () => ({ available: false, reason: "gh authentication expired" }),
    });
    assert.throws(
      () => resolveTracker({}, { adapters: { github } }),
      (error) => (
        error instanceof TrackerUnavailableError &&
        error.tracker === "github" &&
        /no fallback was attempted/i.test(error.message)
      ),
    );
  });

  it("normalizes throwing, undefined, malformed, and reasonless availability failures", () => {
    const cases = [
      {
        availability: () => {
          throw new Error("socket reset");
        },
        reason: /availability probe threw: socket reset/,
      },
      {
        availability: () => undefined,
        reason: /returned an unusable report/,
      },
      {
        availability: () => ({ available: "yes" }),
        reason: /returned an unusable report/,
      },
      {
        availability: () => ({ available: false }),
        reason: /reported unavailable without an actionable reason/,
      },
    ];

    for (const row of cases) {
      assert.throws(
        () => resolveTracker(
          { tracker: "github" },
          { adapters: { github: adapter({ availability: row.availability }) } },
        ),
        (error) => {
          assert.ok(error instanceof TrackerUnavailableError);
          assert.equal(error.tracker, "github");
          assert.match(error.reason, row.reason);
          assert.match(error.message, /no fallback was attempted/i);
          return true;
        },
      );
    }
  });
});

describe("retained adapter portability seam", () => {
  it("keeps one exact operation shape for production and injected fake-gh adapters", () => {
    assert.deepEqual(Object.keys(TRACKER_ADAPTERS), ["github"]);
    assert.equal(validateAdapter("github", TRACKER_ADAPTERS.github), TRACKER_ADAPTERS.github);
    const injected = adapter();
    assert.equal(validateAdapter("github", injected), injected);
    assert.deepEqual([...REQUIRED_ADAPTER_OPERATIONS], [
      "availability", "capabilities", "list", "read", "create", "update", "close",
    ]);
  });

  it("rejects malformed adapters before any operation", () => {
    assert.throws(
      () => resolveTracker({ tracker: "github" }, { adapters: {} }),
      /No adapter is registered/,
    );
    const missingClose = adapter();
    delete missingClose.close;
    assert.throws(() => validateAdapter("github", missingClose), /missing: close/);
    assert.throws(
      () => validateAdapter("github", adapter({ read: true })),
      /not functions: read/,
    );
    assert.throws(
      () => validateAdapter("github", { ...adapter(), extra: () => {} }),
      /not part of the required interface/,
    );
  });

  it("validates GitHub identities and rejects missing, empty, extra, or invalid fields", () => {
    const identity = {
      tracker: "github",
      id: "42",
      ref: "#42",
      url: "https://github.com/acme/widgets/issues/42",
    };
    assert.equal(validateIdentity(identity), identity);
    for (const invalid of [
      null,
      {},
      { tracker: "github", id: "42" },
      { tracker: "github", ref: "#42" },
      { tracker: "", id: "42", ref: "#42" },
      { tracker: "local", id: "42", ref: "#42" },
      { tracker: "github", id: "", ref: "#42" },
      { tracker: "github", id: "42", ref: "" },
      { tracker: "github", id: "42", ref: "#42", url: "not a url" },
      { tracker: "github", id: "42", ref: "#42", number: 42 },
      Object.create({ tracker: "github", id: "42", ref: "#42" }),
    ]) {
      assert.throws(() => validateIdentity(invalid), TrackerIdentityError);
    }
  });

  it("rejects unknown, duplicate, and non-array capability reports", () => {
    for (const [reported, pattern] of [
      [["projects"], /unknown: projects/],
      [["comments", "comments"], /duplicate: comments/],
      [new Set(["comments"]), /must be reported as an array/],
    ]) {
      assert.throws(
        () => readCapabilities("github", adapter({ capabilities: () => reported })),
        pattern,
      );
    }
  });

  it("retains capability gates for injected transports without adding providers", () => {
    const noProjects = adapter({ capabilities: () => [] });
    const resolved = { tracker: "github", adapter: noProjects };
    assert.deepEqual(readCapabilities("github", TRACKER_ADAPTERS.github), [...CAPABILITY_NAMES]);
    assert.throws(
      () => invokeCapability(resolved, "milestones", () => "effect"),
      UnsupportedTrackerCapabilityError,
    );
  });

  it("serializes unsupported capability errors for JSON and human CLIs", () => {
    const error = new UnsupportedTrackerCapabilityError("github", "comments");
    const serialized = serializeTrackerError(error);
    assert.deepEqual(serialized, {
      code: "TRACKER_CAPABILITY_UNSUPPORTED",
      tracker: "github",
      capability: "comments",
      message: 'Tracker "github" does not support capability "comments".',
      remediation:
        'Use tracker "github" without "comments", or restore that ' +
        "tracker's capability transport before retrying. " +
        "No tracker switch or fallback was attempted.",
    });
    assert.equal(serializeTrackerError(new Error("other")), null);

    const jsonWrites = [];
    const humanWrites = [];
    assert.equal(writeTrackerCliError(error, {
      json: true,
      stdout: { write: (value) => jsonWrites.push(value) },
      stderr: { write: () => assert.fail("JSON errors must not use stderr") },
    }), true);
    assert.deepEqual(JSON.parse(jsonWrites.join("")), { error: serialized });

    assert.equal(writeTrackerCliError(error, {
      prefix: "dev-backlog: ",
      stdout: { write: () => assert.fail("human errors must not use stdout") },
      stderr: { write: (value) => humanWrites.push(value) },
    }), true);
    assert.equal(
      humanWrites.join(""),
      `dev-backlog: ${serialized.message}\n${serialized.remediation}\n`,
    );
    assert.equal(writeTrackerCliError(new Error("other"), {
      stdout: { write: () => assert.fail("unrecognized errors must not be written") },
      stderr: { write: () => assert.fail("unrecognized errors must not be written") },
    }), false);
  });

  it("runs a supported capability effect exactly once and returns its value", () => {
    let effects = 0;
    const resolved = {
      tracker: "github",
      adapter: adapter({ capabilities: () => ["comments"] }),
    };
    const result = invokeCapability(resolved, "comments", (issue) => {
      effects += 1;
      return `commented:${issue}`;
    }, 42);

    assert.equal(result, "commented:42");
    assert.equal(effects, 1);
  });
});
