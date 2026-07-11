const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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
  resolveTracker,
  selectTracker,
  validateAdapter,
  validateIdentity,
} = require("./tracker.js");

function makeAdapter(overrides = {}) {
  return {
    availability: () => ({ available: true }),
    capabilities: () => [],
    list: () => [],
    read: () => null,
    create: (task) => task,
    update: (task) => task,
    close: (task) => task,
    ...overrides,
  };
}

describe("configured tracker selection", () => {
  it("persists exactly one top-level github selection in this repository", () => {
    const configPath = path.resolve(__dirname, "../../../backlog/config.yml");
    const raw = fs.readFileSync(configPath, "utf8");
    assert.deepEqual(raw.match(/^tracker:\s*github\s*$/gm), ["tracker: github"]);
  });

  it("uses github as the deterministic compatibility default", () => {
    assert.equal(selectTracker({}), "github");
    assert.equal(selectTracker(), "github");
  });

  it("accepts explicit github and local selections", () => {
    assert.equal(selectTracker({ tracker: "github" }), "github");
    assert.equal(selectTracker({ tracker: "local" }), "local");
  });

  it("rejects invalid and non-string selections before adapter use", () => {
    for (const value of ["gitlab", "", 7, false, null, undefined, [], {}]) {
      let adapterRead = false;
      const adapters = {};
      Object.defineProperty(adapters, "github", {
        get() {
          adapterRead = true;
          return makeAdapter();
        },
      });

      assert.throws(
        () => resolveTracker({ tracker: value }, { adapters }),
        (error) => {
          const rendered = typeof value === "string"
            ? value
            : JSON.stringify(value) ?? String(value);
          assert.ok(error instanceof TrackerConfigurationError);
          assert.match(error.message, /github/);
          assert.match(error.message, /local/);
          assert.ok(error.message.includes(rendered));
          return true;
        }
      );
      assert.equal(adapterRead, false);
    }
  });
});

describe("configured-only resolution", () => {
  it("resolves the built-in github slot for missing and explicit selection", () => {
    for (const config of [{}, { tracker: "github" }]) {
      const resolved = resolveTracker(config);
      assert.equal(resolved.tracker, "github");
      assert.equal(resolved.adapter, TRACKER_ADAPTERS.github);
      assert.deepEqual(resolved.availability, { available: true });
    }
  });

  it("fails explicitly selected local resolution with its #276 reason", () => {
    assert.throws(
      () => resolveTracker({ tracker: "local" }),
      (error) => {
        assert.ok(error instanceof TrackerUnavailableError);
        assert.equal(error.tracker, "local");
        assert.match(error.reason, /#276/);
        return true;
      }
    );
  });

  it("probes and returns only the configured adapter", () => {
    let githubProbes = 0;
    let localProbes = 0;
    const github = makeAdapter({
      availability: () => {
        githubProbes += 1;
        return { available: true };
      },
    });
    const local = makeAdapter({
      availability: () => {
        localProbes += 1;
        throw new Error("must not probe local");
      },
    });

    const resolved = resolveTracker({ tracker: "github" }, { adapters: { github, local } });

    assert.equal(resolved.tracker, "github");
    assert.equal(resolved.adapter, github);
    assert.equal(githubProbes, 1);
    assert.equal(localProbes, 0);
  });

  it("fails without fallback when the configured adapter is unavailable", () => {
    let localProbes = 0;
    const github = makeAdapter({
      availability: () => ({ available: false, reason: "gh authentication expired" }),
    });
    const local = makeAdapter({
      availability: () => {
        localProbes += 1;
        return { available: true };
      },
    });

    assert.throws(
      () => resolveTracker({ tracker: "github" }, { adapters: { github, local } }),
      (error) => {
        assert.ok(error instanceof TrackerUnavailableError);
        assert.equal(error.tracker, "github");
        assert.equal(error.reason, "gh authentication expired");
        assert.match(error.message, /github/);
        assert.match(error.message, /gh authentication expired/);
        return true;
      }
    );
    assert.equal(localProbes, 0);
  });

  it("wraps throwing and unusable availability probes with configured-tracker context", () => {
    for (const availability of [
      () => {
        throw new Error("socket reset");
      },
      () => undefined,
      () => ({ available: "yes" }),
      () => ({ available: false }),
    ]) {
      assert.throws(
        () => resolveTracker(
          { tracker: "github" },
          { adapters: { github: makeAdapter({ availability }), local: makeAdapter() } }
        ),
        (error) => {
          assert.ok(error instanceof TrackerUnavailableError);
          assert.equal(error.tracker, "github");
          assert.ok(error.reason);
          assert.match(error.message, /github/);
          return true;
        }
      );
    }
  });
});

describe("adapter contract", () => {
  it("contains exactly the seven required operations", () => {
    assert.deepEqual(REQUIRED_ADAPTER_OPERATIONS, [
      "availability",
      "capabilities",
      "list",
      "read",
      "create",
      "update",
      "close",
    ]);
  });

  it("validates both built-in adapter slots against the same exact shape", () => {
    assert.equal(validateAdapter("github", TRACKER_ADAPTERS.github), TRACKER_ADAPTERS.github);
    assert.equal(validateAdapter("local", TRACKER_ADAPTERS.local), TRACKER_ADAPTERS.local);
    assert.deepEqual(Object.keys(TRACKER_ADAPTERS.github), REQUIRED_ADAPTER_OPERATIONS);
    assert.deepEqual(Object.keys(TRACKER_ADAPTERS.local), REQUIRED_ADAPTER_OPERATIONS);
  });

  it("rejects missing, non-function, and provider-specific required methods", () => {
    const missingClose = makeAdapter();
    delete missingClose.close;
    assert.throws(() => validateAdapter("github", missingClose), TrackerContractError);
    assert.throws(
      () => validateAdapter("github", makeAdapter({ read: true })),
      TrackerContractError
    );
    assert.throws(
      () => validateAdapter("github", { ...makeAdapter(), milestones: () => [] }),
      TrackerContractError
    );
  });
});

describe("normalized tracker identity", () => {
  it("accepts opaque ids and an optional provider URL", () => {
    const withoutUrl = { tracker: "local", id: "task:alpha/7", ref: "BACK-7" };
    const withUrl = {
      tracker: "github",
      id: "I_kwDOOpaqueNodeId",
      ref: "#273",
      url: "https://github.com/sungjunlee/dev-backlog/issues/273",
    };

    assert.equal(validateIdentity(withoutUrl), withoutUrl);
    assert.equal(validateIdentity(withUrl), withUrl);
  });

  it("rejects missing, empty, fabricated, and extra identity fields", () => {
    for (const identity of [
      null,
      {},
      { tracker: "github", id: "id" },
      { tracker: "github", ref: "#1" },
      { tracker: "", id: "id", ref: "#1" },
      { tracker: "gitlab", id: "id", ref: "#1" },
      { tracker: "github", id: "", ref: "#1" },
      { tracker: "github", id: "id", ref: "" },
      { tracker: "github", id: "id", ref: "#1", url: "not a url" },
      { tracker: "github", id: "id", ref: "#1", number: 1 },
      Object.create({ tracker: "github", id: "id", ref: "#1" }),
    ]) {
      assert.throws(() => validateIdentity(identity), TrackerIdentityError);
    }
  });
});

describe("local adapter and optional capabilities", () => {
  it("reports local as implementation-pending and fails every lifecycle operation consistently", () => {
    const local = TRACKER_ADAPTERS.local;
    const report = local.availability();
    assert.equal(report.available, false);
    assert.match(report.reason, /#276/);

    const errors = [];
    for (const operation of ["list", "read", "create", "update", "close"]) {
      assert.throws(
        () => local[operation](),
        (error) => {
          errors.push(error);
          assert.ok(error instanceof TrackerUnavailableError);
          assert.equal(error.tracker, "local");
          assert.equal(error.reason, report.reason);
          return true;
        }
      );
    }
    assert.equal(new Set(errors.map((error) => error.message)).size, 1);
  });

  it("reports only the six named optional provider capabilities", () => {
    assert.deepEqual(CAPABILITY_NAMES, [
      "milestones",
      "pull-request-relationships",
      "mirrors",
      "progress-issues",
      "comments",
      "closing-semantics",
    ]);
    assert.deepEqual(TRACKER_ADAPTERS.github.capabilities(), CAPABILITY_NAMES);
    assert.deepEqual(TRACKER_ADAPTERS.local.capabilities(), []);
  });

  it("rejects unsupported capability invocation before mutation", () => {
    let mutations = 0;
    const resolved = {
      tracker: "local",
      adapter: TRACKER_ADAPTERS.local,
    };

    assert.throws(
      () => invokeCapability(resolved, "comments", () => {
        mutations += 1;
      }),
      (error) => {
        assert.ok(error instanceof UnsupportedTrackerCapabilityError);
        assert.equal(error.tracker, "local");
        assert.equal(error.capability, "comments");
        assert.match(error.message, /local/);
        assert.match(error.message, /comments/);
        return true;
      }
    );
    assert.equal(mutations, 0);
  });

  it("invokes a supported capability only after the gate succeeds", () => {
    const resolved = {
      tracker: "github",
      adapter: makeAdapter({ capabilities: () => ["comments"] }),
    };
    const result = invokeCapability(resolved, "comments", (value) => `commented:${value}`, 273);
    assert.equal(result, "commented:273");
  });
});
