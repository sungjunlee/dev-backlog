const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  containsTaskRef,
  parsePlanCheckbox,
  parseTaskFileName,
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
    assert.equal(containsTaskRef("- 2026-07-01: review → PR #1", one), false);
  });

  it("accepts sentence punctuation but rejects GitHub token suffixes and decimals", () => {
    const task = parseTaskRef("#42", OPTIONS);
    assert.equal(containsTaskRef("- 2026-07-01: completed #42.", task), true);
    assert.equal(containsTaskRef("- 2026-07-01: completed (#42),", task), true);
    assert.equal(containsTaskRef("- 2026-07-01: #42abc is not exact", task), false);
    assert.equal(containsTaskRef("- 2026-07-01: #42_suffix is not exact", task), false);
    assert.equal(containsTaskRef("- 2026-07-01: #42.1 is not an issue ref", task), false);
  });

  it("keeps BACK-1 distinct from BACK-11 and decimal descendants", () => {
    const one = parseTaskRef("BACK-1", OPTIONS);
    assert.equal(containsTaskRef("- 2026-07-01: BACK-1 started", one), true);
    assert.equal(containsTaskRef("- 2026-07-01: BACK-11 started", one), false);
    assert.equal(containsTaskRef("- 2026-07-01: BACK-1.1 started", one), false);
    assert.equal(containsTaskRef("- 2026-07-01: XBACK-1 started", one), false);
  });

  it("accepts local sentence punctuation but rejects token suffixes and descendants", () => {
    const task = parseTaskRef("BACK-42", OPTIONS);
    assert.equal(containsTaskRef("- 2026-07-01: completed BACK-42.", task), true);
    assert.equal(containsTaskRef("- 2026-07-01: completed (BACK-42),", task), true);
    assert.equal(containsTaskRef("- 2026-07-01: BACK-42abc is not exact", task), false);
    assert.equal(containsTaskRef("- 2026-07-01: BACK-42_suffix is not exact", task), false);
    assert.equal(containsTaskRef("- 2026-07-01: BACK-42.1 is a descendant", task), false);
  });
});

describe("Plan and task-file boundaries", () => {
  it("parses only a complete task token after a supported checkbox", () => {
    assert.deepEqual(parsePlanCheckbox("- [~] BACK-1.2 Child [branch:child]", OPTIONS), {
      checkboxState: "~",
      identity: { tracker: "local", id: "1.2", ref: "BACK-1.2" },
      title: "Child [branch:child]",
    });
    assert.equal(parsePlanCheckbox("- [ ] BACK-1.2x Partial", OPTIONS), null);
  });

  it("parses exact configured task filenames and keeps tracker aliases explicit", () => {
    assert.deepEqual(parseTaskFileName("BACK-1 - short.md", {
      ...OPTIONS,
      tracker: "github",
    }), { tracker: "github", id: "1", ref: "#1" });
    assert.deepEqual(parseTaskFileName("BACK-11.2 - child.md", {
      ...OPTIONS,
      tracker: "local",
    }), { tracker: "local", id: "11.2", ref: "BACK-11.2" });
    assert.equal(parseTaskFileName("BACK-1x - partial.md", OPTIONS), null);
    assert.equal(parseTaskFileName("OTHER-1 - foreign.md", OPTIONS), null);
  });

  it("infers identity before a numeric slug instead of treating the slug as the id", () => {
    assert.deepEqual(parseTaskFileName("BACK-1 - phase-2.md", {
      tracker: "github",
    }), { tracker: "github", id: "1", ref: "#1" });
    assert.deepEqual(parseTaskFileName("BACK-11.2 - phase-3.md", {
      tracker: "local",
    }), { tracker: "local", id: "11.2", ref: "BACK-11.2" });
  });
});
