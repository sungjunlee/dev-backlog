const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  makeMarker,
  parseArgs,
  resolveSprintState,
  formatPointer,
  formatPlanItem,
  renderPlanSection,
  renderProgressSection,
  renderMirrorBody,
  findMirrorIssue,
  sync,
} = require("./sprint-mirror.js");

// --- Test fixtures ---

function planItem(overrides = {}) {
  const tracker = overrides.tracker || "github";
  const id = overrides.id || String(overrides.issue_number || 1);
  const ref = overrides.ref || (tracker === "github" ? `#${id}` : `BACK-${id}`);
  return {
    line: "- [ ] #1 Do the thing",
    checkbox_state: " ",
    state: "todo",
    tracker,
    id,
    ref,
    issue_number: tracker === "github" ? Number(id) : null,
    title: "Do the thing",
    batch_heading: null,
    pr: null,
    run_id: null,
    branch: null,
    unmoored: false,
    ...overrides,
  };
}

function sprintState(overrides = {}) {
  return {
    schema_version: 2,
    active_sprint: {
      path: "backlog/sprints/2026-07-sample-sprint.md",
      frontmatter: { status: "active" },
      goal: "Ship the thing.",
    },
    plan_items: [planItem()],
    next_batch: null,
    latest_progress: [{ line: "- 2026-07-04: Started.", date: "2026-07-04" }],
    in_flight: [],
    ...overrides,
  };
}

/**
 * Build a fake execFile that dispatches on whether the call targets
 * sprint-state.js (node subprocess) or gh (GitHub CLI), matching the two
 * subprocess boundaries sprint-mirror.js shells out to.
 */
function makeExecFile({
  state = sprintState(),
  stateThrows = null,
  issues = [],
  createdIssueNumber = 99,
} = {}) {
  const calls = [];
  const execFile = (cmd, args) => {
    calls.push({ cmd, args });

    const isSprintStateCall = args.some((a) => String(a).includes("sprint-state.js"));
    if (isSprintStateCall) {
      if (stateThrows) throw stateThrows;
      return JSON.stringify(state);
    }

    const joined = args.join(" ");
    if (joined.includes("issue list")) return JSON.stringify(issues);
    if (joined.includes("issue create")) return `https://github.com/owner/repo/issues/${createdIssueNumber}\n`;
    if (joined.includes("issue edit")) return "";
    return "[]";
  };
  return { execFile, calls };
}

// --- parseArgs ---

describe("parseArgs", () => {
  it("defaults to backlog dir with no flags", () => {
    const parsed = parseArgs([]);
    assert.deepEqual(parsed, { backlogDir: "backlog", dryRun: false, json: false, track: null });
  });

  it("parses --track in both flag forms (#292)", () => {
    assert.equal(parseArgs(["--track", "2026-07-auth"]).track, "2026-07-auth");
    assert.equal(parseArgs(["--track=2026-07-auth"]).track, "2026-07-auth");
  });

  it("rejects --track without a value (#292)", () => {
    assert.match(parseArgs(["--track"]).error, /Missing value for --track/);
  });

  it("parses backlog-dir, --dry-run, and --json together", () => {
    const parsed = parseArgs(["custom-dir", "--dry-run", "--json"]);
    assert.equal(parsed.backlogDir, "custom-dir");
    assert.equal(parsed.dryRun, true);
    assert.equal(parsed.json, true);
  });

  it("rejects unknown flags", () => {
    const parsed = parseArgs(["--bogus"]);
    assert.match(parsed.error, /Unknown argument/);
  });

  it("rejects a second positional argument", () => {
    const parsed = parseArgs(["dir-one", "dir-two"]);
    assert.match(parsed.error, /Unexpected argument/);
  });
});

// --- makeMarker ---

describe("makeMarker", () => {
  it("embeds the sprint slug", () => {
    assert.equal(
      makeMarker("2026-07-sample-sprint"),
      "<!-- dev-backlog:sprint-mirror sprint=2026-07-sample-sprint -->"
    );
  });
});

// --- resolveSprintState ---

describe("resolveSprintState", () => {
  it("invokes sprint-state.js with --mode status and the backlog dir", () => {
    const { execFile, calls } = makeExecFile();
    resolveSprintState({ backlogDir: "backlog", execFile });

    assert.equal(calls.length, 1);
    assert.ok(calls[0].args.some((a) => String(a).includes("sprint-state.js")));
    assert.deepEqual(calls[0].args.slice(1), ["--mode", "status", "backlog"]);
  });

  it("returns the parsed state when there is exactly one active sprint", () => {
    const { execFile } = makeExecFile();
    const state = resolveSprintState({ execFile });
    assert.equal(state.active_sprint.path, "backlog/sprints/2026-07-sample-sprint.md");
  });

  it("refuses when there is no active sprint", () => {
    const { execFile } = makeExecFile({ state: { schema_version: 1, active_sprint: null } });
    assert.throws(() => resolveSprintState({ execFile }), /No active sprint/);
  });

  it("passes --track through to sprint-state.js (#292)", () => {
    const { execFile, calls } = makeExecFile();
    resolveSprintState({ backlogDir: "backlog", execFile, track: "2026-07-auth" });

    assert.deepEqual(calls[0].args.slice(1), ["--mode", "status", "--track", "2026-07-auth", "backlog"]);
  });

  it("asks for --track when a portfolio of tracks is active (#292)", () => {
    const { execFile } = makeExecFile({
      state: {
        schema_version: 2,
        active_sprint: null,
        active_sprints: [
          { active_sprint: { path: "backlog/sprints/2026-07-auth.md" } },
          { active_sprint: { path: "backlog/sprints/2026-07-billing.md" } },
        ],
      },
    });

    assert.throws(
      () => resolveSprintState({ execFile }),
      /Multiple active tracks \(2026-07-auth, 2026-07-billing\)\. Pass --track/
    );
  });

  it("refuses a --track selector that matches no active track (#292)", () => {
    const { execFile } = makeExecFile({
      state: { schema_version: 2, active_sprint: null, active_sprints: [] },
    });

    assert.throws(
      () => resolveSprintState({ execFile, track: "nope" }),
      /No active track matches 'nope'/
    );
  });

  it("refuses loudly when sprint-state.js fails (ambiguous active sprints)", () => {
    const failure = new Error("Multiple active sprint files found");
    failure.stderr = "Multiple active sprint files found:\n  a.md\n  b.md";
    const { execFile } = makeExecFile({ stateThrows: failure });

    assert.throws(
      () => resolveSprintState({ execFile }),
      /refusing to guess active sprint/
    );
  });

  it("rejects an unsupported schema_version", () => {
    const { execFile } = makeExecFile({ state: { ...sprintState(), schema_version: 99 } });
    assert.throws(() => resolveSprintState({ execFile }), /Unsupported sprint-state schema_version/);
  });

  it("rejects invalid JSON from sprint-state.js", () => {
    const execFile = () => "not json";
    assert.throws(() => resolveSprintState({ execFile }), /invalid JSON/);
  });
});

// --- formatPointer / formatPlanItem ---

describe("formatPointer", () => {
  it("renders a PR annotation", () => {
    const item = planItem({ pr: { number: 42, state: "merged" } });
    assert.equal(formatPointer(item), " — PR #42 (merged)");
  });

  it("renders a run-id-only annotation", () => {
    const item = planItem({ run_id: "run-abc" });
    assert.equal(formatPointer(item), " — run:run-abc");
  });

  it("renders a branch annotation", () => {
    const item = planItem({ branch: "issue-42" });
    assert.equal(formatPointer(item), " — branch issue-42");
  });

  it("renders unmoored items distinctly", () => {
    const item = planItem({ state: "in_flight", checkbox_state: "~", unmoored: true });
    assert.equal(formatPointer(item), " — (unmoored)");
  });

  it("renders nothing for a plain todo item", () => {
    assert.equal(formatPointer(planItem()), "");
  });
});

describe("formatPlanItem", () => {
  it("combines checkbox state, issue number, title, and pointer", () => {
    const item = planItem({ pr: { number: 7, state: "open" } });
    assert.equal(formatPlanItem(item), "- [ ] #1 Do the thing — PR #7 (open)");
  });

  it("keeps the exported formatter compatible with legacy GitHub item input", () => {
    const item = planItem();
    delete item.tracker;
    delete item.id;
    delete item.ref;
    assert.equal(formatPlanItem(item), "- [ ] #1 Do the thing");
  });

  it("renders local normalized refs without fabricating a GitHub issue number", () => {
    const item = planItem({ tracker: "local", id: "11.2", ref: "BACK-11.2" });
    assert.equal(item.issue_number, null);
    assert.equal(formatPlanItem(item), "- [ ] BACK-11.2 Do the thing");
  });
});

// --- renderPlanSection / renderProgressSection / renderMirrorBody ---

describe("renderPlanSection", () => {
  it("renders all plan item shapes without crashing", () => {
    const items = [
      planItem({ issue_number: 1, title: "PR item", pr: { number: 7, state: "merged" } }),
      planItem({ issue_number: 2, title: "Run item", checkbox_state: "~", state: "in_flight", run_id: "run-1" }),
      planItem({ issue_number: 3, title: "Unmoored item", checkbox_state: "~", state: "in_flight", unmoored: true }),
      planItem({ issue_number: 4, title: "Plain item" }),
    ];
    const lines = renderPlanSection(items);
    assert.ok(lines.some((l) => l.includes("PR #7 (merged)")));
    assert.ok(lines.some((l) => l.includes("run:run-1")));
    assert.ok(lines.some((l) => l.includes("(unmoored)")));
    assert.ok(lines.some((l) => l === "- [ ] #4 Plain item"));
  });

  it("groups items under batch headings with separating blank lines", () => {
    const items = [
      planItem({ issue_number: 1, batch_heading: "### Batch 1" }),
      planItem({ issue_number: 2, batch_heading: "### Batch 2" }),
    ];
    const lines = renderPlanSection(items);
    assert.deepEqual(lines, [
      "### Batch 1",
      "- [ ] #1 Do the thing",
      "",
      "### Batch 2",
      "- [ ] #2 Do the thing",
    ]);
  });

  it("renders a placeholder for an empty plan", () => {
    assert.deepEqual(renderPlanSection([]), ["_No plan items._"]);
  });
});

describe("renderProgressSection", () => {
  it("renders progress lines", () => {
    const lines = renderProgressSection([{ line: "- 2026-07-04: Did the thing.", date: "2026-07-04" }]);
    assert.deepEqual(lines, ["- 2026-07-04: Did the thing."]);
  });

  it("renders a placeholder for an empty progress list", () => {
    assert.deepEqual(renderProgressSection([]), ["_No progress recorded yet._"]);
    assert.deepEqual(renderProgressSection(undefined), ["_No progress recorded yet._"]);
  });
});

describe("renderMirrorBody", () => {
  it("renders marker, blockquote, goal, plan, progress, and sync footer without crashing", () => {
    const state = sprintState({
      plan_items: [
        planItem({ issue_number: 1, title: "PR item", pr: { number: 7, state: "merged" } }),
        planItem({ issue_number: 2, title: "Run item", run_id: "run-1" }),
        planItem({ issue_number: 3, title: "Unmoored", checkbox_state: "~", state: "in_flight", unmoored: true }),
      ],
      latest_progress: [],
    });
    const body = renderMirrorBody({ state, slug: "2026-07-sample-sprint", now: new Date("2026-07-04T12:00:00Z") });

    assert.equal(body, `<!-- dev-backlog:sprint-mirror sprint=2026-07-sample-sprint -->

> The local sprint file is canonical. This mirror is read-only — it is
> not edited by hand — and sync is always explicit; there is no daemon.

## Goal

Ship the thing.

## Plan

- [ ] #1 PR item — PR #7 (merged)
- [ ] #2 Run item — run:run-1
- [~] #3 Unmoored — (unmoored)

## Latest Progress

_No progress recorded yet._

Last explicit sync: 2026-07-04T12:00:00.000Z`);
  });
});

// --- findMirrorIssue ---

describe("findMirrorIssue", () => {
  it("matches the exact marker string in the body", () => {
    const marker = "<!-- dev-backlog:sprint-mirror sprint=2026-07-sample-sprint -->";
    const execFile = () => JSON.stringify([
      { number: 1, body: "unrelated body" },
      { number: 2, body: `${marker}\nrest of body` },
    ]);
    const issue = findMirrorIssue(marker, execFile);
    assert.equal(issue.number, 2);
  });

  it("returns null when no issue matches", () => {
    const execFile = () => JSON.stringify([{ number: 1, body: "unrelated" }]);
    assert.equal(findMirrorIssue("<!-- dev-backlog:sprint-mirror sprint=none -->", execFile), null);
  });
});

// --- sync (integration) ---

describe("sync", () => {
  it("creates a new mirror issue when none exists", () => {
    const { execFile, calls } = makeExecFile({ issues: [], createdIssueNumber: 55 });
    const result = sync({ execFile });

    assert.equal(result.action, "created");
    assert.equal(result.issue_number, 55);
    assert.equal(result.sprint, "2026-07-sample-sprint");
    assert.ok(calls.some((c) => c.args.join(" ").includes("issue create")));
    assert.ok(!calls.some((c) => c.args.join(" ").includes("issue edit")));
  });

  it("updates the existing mirror issue found by marker (idempotent identity)", () => {
    const marker = "<!-- dev-backlog:sprint-mirror sprint=2026-07-sample-sprint -->";
    const { execFile, calls } = makeExecFile({
      issues: [{ number: 7, body: `${marker}\nold body` }],
    });
    const result = sync({ execFile });

    assert.equal(result.action, "updated");
    assert.equal(result.issue_number, 7);
    assert.ok(calls.some((c) => c.args.join(" ").includes("issue edit 7")));
    assert.ok(!calls.some((c) => c.args.join(" ").includes("issue create")));
  });

  it("is idempotent across repeated runs against the same mirror issue", () => {
    const marker = "<!-- dev-backlog:sprint-mirror sprint=2026-07-sample-sprint -->";
    const { execFile } = makeExecFile({
      issues: [{ number: 7, body: `${marker}\nold body` }],
    });
    const first = sync({ execFile });
    const second = sync({ execFile });

    assert.equal(first.issue_number, 7);
    assert.equal(second.issue_number, 7);
    assert.equal(first.action, "updated");
    assert.equal(second.action, "updated");
  });

  it("refuses when sprint-state reports no active sprint", () => {
    const { execFile } = makeExecFile({ state: { schema_version: 1, active_sprint: null } });
    assert.throws(() => sync({ execFile }), /No active sprint/);
  });

  it("refuses when sprint-state.js fails on ambiguous active sprints", () => {
    const failure = new Error("Multiple active sprint files found");
    failure.stderr = "Multiple active sprint files found";
    const { execFile } = makeExecFile({ stateThrows: failure });
    assert.throws(() => sync({ execFile }), /refusing to guess active sprint/);
  });

  it("--dry-run performs no mutating gh commands", () => {
    const { execFile, calls } = makeExecFile({ issues: [] });
    const result = sync({ execFile, dryRun: true });

    assert.equal(result.action, "dry-run");
    assert.equal(result.issue_number, null);
    assert.ok(result.body.length > 0);
    assert.ok(!calls.some((c) => c.args.join(" ").includes("issue create")));
    assert.ok(!calls.some((c) => c.args.join(" ").includes("issue edit")));
  });

  it("--dry-run reports the target issue number when a mirror already exists", () => {
    const marker = "<!-- dev-backlog:sprint-mirror sprint=2026-07-sample-sprint -->";
    const { execFile, calls } = makeExecFile({
      issues: [{ number: 7, body: `${marker}\nold body` }],
    });
    const result = sync({ execFile, dryRun: true });

    assert.equal(result.action, "dry-run");
    assert.equal(result.issue_number, 7);
    assert.ok(!calls.some((c) => c.args.join(" ").includes("issue create")));
    assert.ok(!calls.some((c) => c.args.join(" ").includes("issue edit")));
  });
});
