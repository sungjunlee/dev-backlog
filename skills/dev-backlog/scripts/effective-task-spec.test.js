const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  GITHUB_RESOLUTION_FIELDS,
  SOURCE_UNAVAILABLE_CODE,
  SPEC_REF_UNAVAILABLE_CODE,
  EffectiveTaskSpecError,
  digestText,
  explicitSpecRef,
  findAgentBriefComment,
  parseCli,
  parseAcceptanceCriteria,
  resolveEffectiveTaskSpec,
} = require("./effective-task-spec.js");

function resolvedTask(task, { tracker = "github", readError } = {}) {
  const reads = [];
  return {
    reads,
    resolved: {
      tracker,
      adapter: {
        read(ref, options) {
          reads.push({ ref, options });
          if (readError) throw readError;
          return { tracker, id: "42", ref: tracker === "github" ? "#42" : "BACK-42", ...task };
        },
      },
    },
  };
}

describe("effective task spec selection", () => {
  it("uses the live Issue body by default and returns stable source evidence", () => {
    const body = [
      "## Outcome",
      "Ship the resolver.",
      "",
      "## Acceptance criteria",
      "- [ ] Reads a live Issue.",
      "- [x] Preserves a checked item.",
      "",
      "## Dependencies",
      "- [ ] This is not acceptance criteria.",
    ].join("\r\n");
    const url = "https://github.com/acme/widgets/issues/42";
    const fixture = resolvedTask({
      body,
      state: "OPEN",
      updatedAt: "2026-07-31T08:00:00Z",
      url,
    });

    const result = resolveEffectiveTaskSpec(fixture.resolved, "#42", {
      repo: "acme/widgets",
    });

    assert.deepEqual(fixture.reads, [{
      ref: "#42",
      options: {
        repo: "acme/widgets",
        fields: GITHUB_RESOLUTION_FIELDS,
      },
    }]);
    assert.equal(result.effective_spec, body.replace(/\r\n/g, "\n"));
    assert.deepEqual(result.acceptance_criteria, [
      { text: "Reads a live Issue.", checked: false },
      { text: "Preserves a checked item.", checked: true },
    ]);
    assert.deepEqual(result.lifecycle, {
      state: "open",
      updated_at: "2026-07-31T08:00:00Z",
    });
    assert.equal(result.source_ref, `${url}#issue-body`);
    assert.equal(result.source_digest, digestText(body));
    assert.equal(result.source_revision, `sha256:${digestText(body)}`);
  });

  it("lets one explicit spec_ref win without silently consulting Issue AC", () => {
    const issueBody = [
      "<!-- dev-backlog:spec_ref docs/task-42.md -->",
      "## Acceptance Criteria",
      "- [ ] Stale Issue criterion.",
    ].join("\n");
    const externalSpec = [
      "# Effective spec",
      "",
      "<!-- AC:BEGIN -->",
      "- [x] External criterion.",
      "<!-- AC:END -->",
    ].join("\n");
    const loads = [];
    const fixture = resolvedTask({
      body: issueBody,
      state: "CLOSED",
      url: "https://github.com/acme/widgets/issues/42",
    });

    const result = resolveEffectiveTaskSpec(fixture.resolved, "#42", {
      loadSpec(ref, context) {
        loads.push({ ref, task: context.task.ref });
        return externalSpec;
      },
    });

    assert.deepEqual(loads, [{ ref: "docs/task-42.md", task: "#42" }]);
    assert.equal(result.effective_spec, externalSpec);
    assert.deepEqual(result.acceptance_criteria, [
      { text: "External criterion.", checked: true },
    ]);
    assert.deepEqual(result.lifecycle, { state: "closed" });
    assert.equal(result.source_ref, "docs/task-42.md");
    assert.equal(result.source_revision, `sha256:${digestText(externalSpec)}`);
  });

  it("accepts an explicit caller specRef for provider-neutral structured metadata", () => {
    const fixture = resolvedTask({
      body: "Issue body",
      state: "open",
      status: "In Progress",
      updated_date: "2026-07-31",
    }, { tracker: "local" });

    const result = resolveEffectiveTaskSpec(fixture.resolved, "BACK-42", {
      specRef: "spec/tasks/42.md",
      loadSpec: () => "- [ ] Loaded explicitly.",
    });

    assert.deepEqual(fixture.reads, [{
      ref: "BACK-42",
      options: { repo: undefined },
    }]);
    assert.deepEqual(result.acceptance_criteria, [
      { text: "Loaded explicitly.", checked: false },
    ]);
    assert.deepEqual(result.lifecycle, {
      state: "open",
      status: "In Progress",
      updated_at: "2026-07-31",
    });
  });

  it("ignores spec_ref examples in fenced, indented, and inline code", () => {
    const task = {
      tracker: "github",
      ref: "#42",
      body: [
        "Use `<!-- dev-backlog:spec_ref docs/inline.md -->` when needed.",
        "",
        "```markdown",
        "<!-- dev-backlog:spec_ref docs/fenced.md -->",
        "```still-code",
        "<!-- dev-backlog:spec_ref docs/still-fenced.md -->",
        "    ```",
        "<!-- dev-backlog:spec_ref docs/after-indented-fake-close.md -->",
        "```",
        "",
        "   ```markdown",
        "    ```",
        "<!-- dev-backlog:spec_ref docs/after-four-space-fake-close.md -->",
        "```",
        "",
        "    <!-- dev-backlog:spec_ref docs/indented.md -->",
        "",
        "A multiline code span: `",
        "<!-- dev-backlog:spec_ref docs/multiline-inline.md -->",
        "` remains documentation.",
        "",
        "The canonical Issue body remains authoritative.",
      ].join("\n"),
    };

    assert.equal(explicitSpecRef(task), null);
  });
});

describe("fail-closed authority boundary", () => {
  it("stops clearly after a live read failure and never reads a task mirror", () => {
    const fixture = resolvedTask({}, {
      readError: new Error("gh auth expired"),
    });
    let specLoads = 0;

    assert.throws(
      () => resolveEffectiveTaskSpec(fixture.resolved, "#42", {
        loadSpec() {
          specLoads += 1;
          return "must not load";
        },
      }),
      (error) => {
        assert.ok(error instanceof EffectiveTaskSpecError);
        assert.equal(error.code, SOURCE_UNAVAILABLE_CODE);
        assert.equal(error.tracker, "github");
        assert.equal(error.task_ref, "#42");
        assert.match(error.message, /gh auth expired/);
        assert.match(error.message, /no task mirror fallback was attempted/);
        assert.match(error.remediation, /diagnostic evidence only/);
        return true;
      }
    );
    assert.equal(fixture.reads.length, 1);
    assert.equal(specLoads, 0);
  });

  it("stops when an explicit spec_ref cannot load instead of using Issue or mirror bytes", () => {
    const fixture = resolvedTask({
      body: [
        "<!-- dev-backlog:spec_ref docs/missing.md -->",
        "- [ ] Issue fallback must not win.",
      ].join("\n"),
      state: "OPEN",
    });

    assert.throws(
      () => resolveEffectiveTaskSpec(fixture.resolved, "#42", {
        loadSpec() {
          throw new Error("ENOENT");
        },
      }),
      (error) => {
        assert.ok(error instanceof EffectiveTaskSpecError);
        assert.equal(error.code, SPEC_REF_UNAVAILABLE_CODE);
        assert.equal(error.source_ref, "docs/missing.md");
        assert.match(error.message, /Execution stopped/);
        assert.match(error.remediation, /Issue body and task mirrors were not used/);
        return true;
      }
    );
  });

  it("rejects empty explicit spec_ref selections instead of falling back to the Issue body", () => {
    const fixture = resolvedTask({
      body: "- [ ] Issue fallback must not win.",
      state: "OPEN",
    });

    assert.throws(
      () => resolveEffectiveTaskSpec(fixture.resolved, "#42", { specRef: "" }),
      (error) => {
        assert.ok(error instanceof EffectiveTaskSpecError);
        assert.equal(error.code, "TASK_SPEC_REF_INVALID");
        assert.match(error.message, /cannot be empty/);
        return true;
      }
    );
  });
});

describe("acceptance criteria parsing and repository spec safety", () => {
  it("uses AC markers before headings and falls back to task lists", () => {
    assert.deepEqual(parseAcceptanceCriteria([
      "- [ ] Outside",
      "<!-- AC:BEGIN -->",
      "- [x] Inside",
      "<!-- AC:END -->",
    ].join("\n")), [{ text: "Inside", checked: true }]);
    assert.deepEqual(parseAcceptanceCriteria("- [ ] Legacy task list"), [
      { text: "Legacy task list", checked: false },
    ]);
    assert.deepEqual(parseAcceptanceCriteria([
      "## Acceptance Criteria",
      "1. [ ] First ordered `criterion`",
      "```markdown",
      "- [ ] Example only",
      "```",
      "2) [x] Second ordered criterion",
      "   with a continuation",
      "",
      "    - PNG",
      "    - JPEG",
    ].join("\n")), [
      { text: "First ordered `criterion`", checked: false },
      {
        text: [
          "Second ordered criterion",
          "   with a continuation",
          "",
          "    - PNG",
          "    - JPEG",
        ].join("\n"),
        checked: true,
      },
    ]);
  });

  it("ignores AC marker and task-list examples in code while retaining real nested content", () => {
    assert.deepEqual(parseAcceptanceCriteria([
      "Document `<!-- AC:BEGIN -->` and `<!-- AC:END -->`.",
      "",
      "## Acceptance Criteria",
      "",
      "    - [ ] Indented code example",
      "",
      "- [ ] Preserve formats:",
      "    - PNG",
      "    - JPEG",
    ].join("\n")), [{
      text: [
        "Preserve formats:",
        "    - PNG",
        "    - JPEG",
      ].join("\n"),
      checked: false,
    }]);
  });

  it("masks fenced task examples nested under ordinary list items", () => {
    assert.deepEqual(parseAcceptanceCriteria([
      "## Acceptance Criteria",
      "",
      "- Documentation:",
      "    ```markdown",
      "    - [ ] Example only",
      "    ```",
      "- [ ] Real criterion",
    ].join("\n")), [{
      text: "Real criterion",
      checked: false,
    }]);
  });

  it("returns from an inner list to the outer fence container", () => {
    const body = [
      "- Outer",
      "  - Inner",
      "  ```markdown",
      "  code",
      "    ```",
      "<!-- dev-backlog:spec_ref docs/real.md -->",
    ].join("\n");
    assert.equal(explicitSpecRef({
      tracker: "github",
      ref: "#42",
      body,
    }), "docs/real.md");
  });

  it("pops an inner list on an outer lazy continuation before opening a fence", () => {
    const body = [
      "- Outer",
      "  - Inner",
      "  Back at outer",
      "    ```markdown",
      "    code",
      "  ```",
      "<!-- dev-backlog:spec_ref docs/real.md -->",
    ].join("\n");
    assert.equal(explicitSpecRef({
      tracker: "github",
      ref: "#42",
      body,
    }), "docs/real.md");
  });

  it("masks retired criteria in HTML comments and preserves lazy continuation text", () => {
    assert.deepEqual(parseAcceptanceCriteria([
      "## Acceptance Criteria",
      "",
      "<!-- retired",
      "- [ ] Old requirement",
      "-->",
      "",
      "- [ ] Reject invalid input",
      "and report the field name",
      "- [x] Keep the next criterion separate",
    ].join("\n")), [
      {
        text: [
          "Reject invalid input",
          "and report the field name",
        ].join("\n"),
        checked: false,
      },
      {
        text: "Keep the next criterion separate",
        checked: true,
      },
    ]);
  });

  it("returns nested task criteria separately so unchecked children cannot hide", () => {
    assert.deepEqual(parseAcceptanceCriteria([
      "## Acceptance Criteria",
      "- [x] Export images",
      "  - [x] PNG",
      "  - [ ] JPEG",
    ].join("\n")), [
      { text: "Export images", checked: true },
      { text: "PNG", checked: true },
      { text: "JPEG", checked: false },
    ]);
  });

  it("parses a mattpocock to-tickets issue template natively", () => {
    // Real shape from mattpocock/skills to-tickets' <issue-template>: headings
    // like ## Parent / ## What to build / ## Blocked by carry no AC markers, so
    // only the ## Acceptance criteria list must be extracted.
    const body = [
      "## Parent",
      "",
      "#123 — parent epic issue",
      "",
      "## What to build",
      "",
      "The end-to-end behaviour this ticket makes work, from the user's perspective — not layer-by-layer implementation.",
      "",
      "## Acceptance criteria",
      "",
      "- [ ] Criterion 1",
      "- [ ] Criterion 2",
      "",
      "## Blocked by",
      "",
      "- #122 — blocking ticket",
      "",
    ].join("\n");
    assert.deepEqual(parseAcceptanceCriteria(body), [
      { text: "Criterion 1", checked: false },
      { text: "Criterion 2", checked: false },
    ]);
  });

  it("loads only repository-contained explicit specs", (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "effective-spec-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    fs.mkdirSync(path.join(root, "docs"));
    fs.writeFileSync(path.join(root, "docs/task.md"), "# Task\n");
    const fixture = resolvedTask({
      body: "<!-- dev-backlog:spec_ref docs/task.md -->",
      state: "OPEN",
    });

    const result = resolveEffectiveTaskSpec(fixture.resolved, "#42", { rootDir: root });
    assert.equal(result.effective_spec, "# Task\n");

    assert.throws(
      () => resolveEffectiveTaskSpec(fixture.resolved, "#42", {
        rootDir: root,
        specRef: "../outside.md",
      }),
      (error) => {
        assert.equal(error.code, SPEC_REF_UNAVAILABLE_CODE);
        assert.match(error.cause.message, /escapes the repository root/);
        return true;
      }
    );
  });
});

describe("AGENT-BRIEF comment support", () => {
  const briefBody = [
    "## Agent Brief",
    "",
    "**Category:** bug",
    "**Summary:** Fix truncation.",
    "",
    "**Current behavior:**",
    "Descriptions cut mid-word.",
    "",
    "**Desired behavior:**",
    "Break at the last word boundary before 1024.",
    "",
    "**Key interfaces:**",
    "- `SkillMetadata.description` — no type change",
    "",
    "**Acceptance criteria:**",
    "- [ ] Break at the last word boundary",
    "- [x] Append \"...\" when truncated",
    "",
    "**Out of scope:**",
    "- Font rendering",
  ].join("\n");

  it("uses the latest AGENT-BRIEF comment as the effective spec", () => {
    const fixture = resolvedTask({
      body: "## Outcome\nStale body text.",
      state: "OPEN",
      url: "https://github.com/acme/widgets/issues/42",
      comments: [
        { id: "1", url: "https://github.com/acme/widgets/issues/42#issuecomment-1", body: "just a note" },
        { id: "2", url: "https://github.com/acme/widgets/issues/42#issuecomment-2", body: briefBody },
      ],
    });

    const result = resolveEffectiveTaskSpec(fixture.resolved, "#42", {
      repo: "acme/widgets",
    });

    assert.equal(result.effective_spec, briefBody);
    assert.equal(result.source_ref, "https://github.com/acme/widgets/issues/42#issuecomment-2");
    assert.deepEqual(result.acceptance_criteria, [
      { text: "Break at the last word boundary", checked: false },
      { text: "Append \"...\" when truncated", checked: true },
    ]);
    assert.equal(result.lifecycle.state, "open");
  });

  it("picks the newest comment when several carry an Agent Brief heading", () => {
    const older = "## Agent Brief\n\n**Acceptance criteria:**\n- [ ] Old criterion";
    const newer = "## Agent Brief\n\n**Acceptance criteria:**\n- [ ] New criterion";
    const fixture = resolvedTask({
      body: "ignored",
      state: "OPEN",
      comments: [
        { id: "1", url: "https://github.com/acme/widgets/issues/42#issuecomment-1", body: older },
        { id: "2", url: "https://github.com/acme/widgets/issues/42#issuecomment-2", body: newer },
      ],
    });

    const result = resolveEffectiveTaskSpec(fixture.resolved, "#42", {});
    assert.equal(result.source_ref, "https://github.com/acme/widgets/issues/42#issuecomment-2");
    assert.deepEqual(result.acceptance_criteria, [
      { text: "New criterion", checked: false },
    ]);
  });

  it("falls back to the issue body when no Agent Brief comment exists", () => {
    const fixture = resolvedTask({
      body: "## Outcome\nNo brief here.",
      state: "OPEN",
      comments: [
        { id: "1", url: "https://github.com/acme/widgets/issues/42#issuecomment-1", body: "**Summary:** an ordinary note" },
      ],
    });

    const result = resolveEffectiveTaskSpec(fixture.resolved, "#42", {});
    assert.equal(result.effective_spec, "## Outcome\nNo brief here.");
  });

  it("lets an explicit spec_ref win over an Agent Brief comment", () => {
    const fixture = resolvedTask({
      body: "<!-- dev-backlog:spec_ref docs/task-42.md -->\n## Outcome\nbody",
      state: "OPEN",
      comments: [
        { id: "2", url: "https://github.com/acme/widgets/issues/42#issuecomment-2", body: briefBody },
      ],
    });

    const result = resolveEffectiveTaskSpec(fixture.resolved, "#42", {
      rootDir: "/tmp",
      loadSpec: () => "# Loaded spec\n\n**Acceptance criteria:**\n- [ ] From spec_ref",
    });

    assert.equal(result.effective_spec, "# Loaded spec\n\n**Acceptance criteria:**\n- [ ] From spec_ref");
  });

  it("extracts bold-label acceptance criteria from a standalone brief", () => {
    assert.deepEqual(parseAcceptanceCriteria(briefBody), [
      { text: "Break at the last word boundary", checked: false },
      { text: "Append \"...\" when truncated", checked: true },
    ]);
  });

  it("findAgentBriefComment ignores briefs inside fenced code blocks", () => {
    const fixture = resolvedTask({
      body: "body",
      comments: [
        { id: "1", url: "https://github.com/acme/widgets/issues/42#issuecomment-1", body: "```markdown\n## Agent Brief\n```" },
      ],
    });
    assert.equal(findAgentBriefComment(fixture.resolved), null);
  });
});

describe("CLI parsing", () => {
  it("rejects flags without values instead of silently changing authority selection", () => {
    assert.throws(
      () => parseCli(["#42", "--spec-ref"]),
      /--spec-ref requires a value/
    );
    assert.throws(
      () => parseCli(["#42", "--repo", "--root", "."]),
      /--repo requires a value/
    );
  });
});
