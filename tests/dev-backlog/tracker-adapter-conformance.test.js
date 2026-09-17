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
  TRACKER_KEYS,
  TrackerConfigurationError,
  TrackerContractError,
  TrackerIdentityError,
  TrackerUnavailableError,
  UnsupportedTrackerCapabilityError,
  invokeCapability,
  readCapabilities,
  resolveTracker,
  selectTracker,
  validateAdapter,
  validateIdentity,
} = require(path.join(SKILL_SCRIPTS, "tracker.js"));

function stubAdapter(overrides = {}) {
  return {
    availability: () => ({ available: true }),
    capabilities: () => ["comments"],
    list: () => [],
    read: (identity) => identity,
    create: (value) => value,
    update: (value) => value,
    close: (value) => value,
    ...overrides,
  };
}

describe("TRACKER_KEYS is config-only", () => {
  it("freezes github and files as the selectable keys", () => {
    assert.deepEqual([...TRACKER_KEYS], ["github", "files"]);
    assert.ok(Object.isFrozen(TRACKER_KEYS));
    assert.deepEqual(Object.keys(TRACKER_ADAPTERS), ["github", "files"]);
    assert.equal(selectTracker(), "github");
    assert.equal(selectTracker({ tracker: "github" }), "github");
    assert.equal(selectTracker({ tracker: "files" }), "files");
    for (const value of ["gitea", "local", ""]) {
      assert.throws(
        () => selectTracker({ tracker: value }),
        (error) => error instanceof TrackerConfigurationError && /expected one of: github, files/.test(error.message),
      );
    }
  });
});

describe("stub adapter conformance", () => {
  it("accepts the exact required operation shape and rejects extras or holes", () => {
    const stub = stubAdapter();
    assert.equal(validateAdapter("github", stub), stub);
    assert.deepEqual(Reflect.ownKeys(stub), [...REQUIRED_ADAPTER_OPERATIONS]);
    for (const name of REQUIRED_ADAPTER_OPERATIONS) {
      assert.equal(typeof stub[name], "function");
    }

    const missingClose = stubAdapter();
    delete missingClose.close;
    assert.throws(() => validateAdapter("github", missingClose), /missing: close/);
    assert.throws(
      () => validateAdapter("github", stubAdapter({ read: true })),
      /not functions: read/,
    );
    assert.throws(
      () => validateAdapter("github", { ...stubAdapter(), extra: () => {} }),
      /not part of the required interface/,
    );
  });

  it("resolves an available stub and fail-closes when unavailable", () => {
    const available = stubAdapter();
    const resolved = resolveTracker({ tracker: "github" }, { adapters: { github: available } });
    assert.equal(resolved.tracker, "github");
    assert.equal(resolved.adapter, available);
    assert.deepEqual(resolved.availability, { available: true });

    assert.throws(
      () => resolveTracker(
        { tracker: "github" },
        { adapters: { github: stubAdapter({ availability: () => ({ available: false, reason: "stub down" }) }) } },
      ),
      (error) => (
        error instanceof TrackerUnavailableError &&
        error.tracker === "github" &&
        error.reason === "stub down" &&
        /no fallback was attempted/i.test(error.message)
      ),
    );
  });

  it("whitelists capabilities and gates invokeCapability", () => {
    const stub = stubAdapter({ capabilities: () => ["comments"] });
    assert.deepEqual(readCapabilities("github", stub), ["comments"]);
    const resolved = { tracker: "github", adapter: stub };
    assert.equal(invokeCapability(resolved, "comments", (n) => `ok:${n}`, 7), "ok:7");
    assert.throws(
      () => invokeCapability(resolved, "milestones", () => "must not run"),
      UnsupportedTrackerCapabilityError,
    );
    assert.throws(
      () => readCapabilities("github", stubAdapter({ capabilities: () => ["comments", "projects"] })),
      /unknown: projects/,
    );
    assert.deepEqual([...CAPABILITY_NAMES], [
      "milestones",
      "pull-request-relationships",
      "comments",
      "closing-semantics",
    ]);
  });

  it("validates identities through validateIdentity", () => {
    const identity = { tracker: "github", id: "99", ref: "#99" };
    assert.equal(validateIdentity(identity), identity);
    const filesIdentity = { tracker: "files", id: "1", ref: "BACK-1" };
    assert.equal(validateIdentity(filesIdentity), filesIdentity);
    assert.throws(
      () => validateIdentity({ tracker: "gitea", id: "1", ref: "#1" }),
      TrackerIdentityError,
    );
    assert.throws(
      () => validateIdentity({ tracker: "github", id: "99", ref: "#99", extra: true }),
      TrackerIdentityError,
    );
  });

  it("never falls back to a files adapter or local files when the stub is unavailable", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tracker-stub-nfb-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const leftoverTasks = path.join(root, "backlog", "tasks");
    fs.mkdirSync(leftoverTasks, { recursive: true });
    fs.writeFileSync(path.join(leftoverTasks, "BACK-1.md"), "not authority\n");

    let filesListCalls = 0;
    const files = stubAdapter({
      list: () => {
        filesListCalls += 1;
        return [{ tracker: "files", id: "1", ref: "files-1" }];
      },
    });
    const github = stubAdapter({
      availability: () => ({ available: false, reason: "injected stub unavailable" }),
    });

    assert.throws(
      () => resolveTracker({ tracker: "github" }, { adapters: { github, files } }),
      (error) => error instanceof TrackerUnavailableError && error.tracker === "github",
    );
    assert.equal(filesListCalls, 0);
    assert.equal(
      fs.readFileSync(path.join(leftoverTasks, "BACK-1.md"), "utf8"),
      "not authority\n",
    );
    assert.throws(
      () => selectTracker({ tracker: "gitea" }),
      TrackerConfigurationError,
    );
  });

  it("never falls back to github when files is configured but unavailable", () => {
    let githubListCalls = 0;
    const files = stubAdapter({
      availability: () => ({ available: false, reason: "backlog CLI missing" }),
    });
    const github = stubAdapter({
      list: () => {
        githubListCalls += 1;
        return [];
      },
    });
    assert.throws(
      () => resolveTracker({ tracker: "files" }, { adapters: { files, github } }),
      (error) => (
        error instanceof TrackerUnavailableError &&
        error.tracker === "files" &&
        /no fallback was attempted/i.test(error.message)
      ),
    );
    assert.equal(githubListCalls, 0);
  });

  it("does not treat a missing registered adapter as a cue to switch", () => {
    assert.throws(
      () => resolveTracker({ tracker: "github" }, { adapters: { files: stubAdapter() } }),
      (error) => error instanceof TrackerContractError && /No adapter is registered for configured tracker "github"/.test(error.message),
    );
  });
});
