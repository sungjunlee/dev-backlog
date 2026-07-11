const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  containsTaskRef,
  parseTaskRef,
  renderTaskRef,
} = require("./task-ref.js");

const OPTIONS = { taskPrefix: "BACK" };

describe("parseTaskRef", () => {
  it("normalizes complete GitHub and configured-prefix refs", () => {
    assert.deepEqual(parseTaskRef("#1", OPTIONS), {
      tracker: "github",
      id: "1",
      ref: "#1",
    });
    assert.deepEqual(parseTaskRef("BACK-42", OPTIONS), {
      tracker: "local",
      id: "42",
      ref: "BACK-42",
    });
  });

  it("preserves supported decimal local subtask identities", () => {
    assert.deepEqual(parseTaskRef("BACK-42.10", OPTIONS), {
      tracker: "local",
      id: "42.10",
      ref: "BACK-42.10",
    });
    assert.equal(parseTaskRef("#42.10", OPTIONS), null);
  });

  it("rejects zero, negative, malformed, partial, and foreign-prefix refs", () => {
    for (const ref of [
      "#0",
      "#-1",
      "#1 trailing",
      "prefix #1",
      "BACK-0",
      "BACK--1",
      "BACK-1.",
      "BACK-1.0",
      "BACK-1.2.3",
      "BACK-1 trailing",
      "OTHER-1",
      "",
    ]) {
      assert.equal(parseTaskRef(ref, OPTIONS), null, ref);
    }
  });
});

describe("renderTaskRef", () => {
  it("renders normalized identities without changing GitHub refs", () => {
    assert.equal(renderTaskRef({ tracker: "github", id: "11" }, OPTIONS), "#11");
    assert.equal(renderTaskRef({ tracker: "local", id: "11.2" }, OPTIONS), "BACK-11.2");
  });

  it("rejects identities outside the task-ref grammar", () => {
    assert.throws(() => renderTaskRef({ tracker: "github", id: "1.2" }, OPTIONS));
    assert.throws(() => renderTaskRef({ tracker: "local", id: "0" }, OPTIONS));
    assert.throws(() => renderTaskRef({ tracker: "other", id: "1" }, OPTIONS));
  });
});

describe("containsTaskRef", () => {
  it("keeps #1 distinct from #11 at both boundaries", () => {
    const one = parseTaskRef("#1", OPTIONS);
    assert.equal(containsTaskRef("- 2026-07-01: #1 started", one), true);
    assert.equal(containsTaskRef("- 2026-07-01: #11 started", one), false);
    assert.equal(containsTaskRef("- 2026-07-01: note#1 started", one), false);
  });

  it("keeps BACK-1 distinct from BACK-11 and decimal descendants", () => {
    const one = parseTaskRef("BACK-1", OPTIONS);
    assert.equal(containsTaskRef("- 2026-07-01: BACK-1 started", one), true);
    assert.equal(containsTaskRef("- 2026-07-01: BACK-11 started", one), false);
    assert.equal(containsTaskRef("- 2026-07-01: BACK-1.1 started", one), false);
    assert.equal(containsTaskRef("- 2026-07-01: XBACK-1 started", one), false);
  });
});
