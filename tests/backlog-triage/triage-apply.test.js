const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawnSync } = require("node:child_process");
const { writeGhFixture } = require("../fakes/fake-gh-fixture.js");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/backlog-triage/scripts");
const {
  parseArgs,
  parseReport,
  dedupActions,
  normalizeArgs,
  buildActionKey,
  buildPriorityEditCommand,
  toGhCommands,
  resolveLogPath,
  readApplyLog,
  execute,
} = require(path.join(SKILL_SCRIPTS, "triage-apply.js"));

function makeReport() {
  return [
    "---",
    "generated: 2026-04-18",
    "repo: sungjunlee/dev-backlog",
    "snapshot: .dev-backlog/triage/.cache/2026-04-18T01-30-00Z.json",
    "open_issues: 5",
    "---",
    "",
    "# Backlog Triage - 2026-04-18",
    "",
    "## Obsolete Candidates",
    "<!-- triage:close #104 reason=\"stale cleanup\" -->",
    "- [x] Close #104 - stale cleanup",
    "",
    "<!-- triage:future-action #999 reason=\"wait for roadmap\" -->",
    "- [x] Future action #999 - wait for roadmap",
    "",
    "## Priority Proposals",
    "<!-- triage:set-priority #101 reason=\" theme auth hot \" value=high -->",
    "- [ ] Set priority:high on #101 - theme auth hot",
    "",
    "## Milestone Suggestions",
    "<!-- triage:assign-milestone #102 name=\"Sprint W17\" cluster=auth -->",
    "",
    "- [x] Assign Sprint W17 to #102",
    "",
    "## Apply Checklist",
    "<!-- triage:close #104 reason=\"stale cleanup\" -->",
    "- [ ] Close #104 - stale cleanup _(from Obsolete Candidates)_",
    "",
    "<!-- triage:set-priority #101 value=high reason=\"theme auth hot\" -->",
    "- [x] Set priority:high on #101 - theme auth hot _(from Priority Proposals)_",
    "",
    "<!-- triage:assign-milestone #102 cluster=auth name=\"Sprint W17\" -->",
    "- [ ] Assign Sprint W17 to #102 _(from Milestone Suggestions)_",
    "",
    "<!-- triage:close-duplicate #103 target=#101 reason=\"duplicate candidate converged\" -->",
    "- [x] Close duplicate #103 into #101 _(from Obsolete Candidates)_",
    "",
  ].join("\n");
}

function acceptedReport(...anchors) {
  return [
    "---",
    "generated: 2026-04-18",
    "---",
    ...anchors.flatMap((anchor) => [anchor, "- [x] Accept", ""]),
  ].join("\n");
}

describe("parseArgs", () => {
  it("parses the positional report path and flags", () => {
    assert.deepEqual(parseArgs(["report.md", "--apply", "--yes", "--json"]), {
      reportPath: "report.md",
      apply: true,
      yes: true,
      json: true,
    });
  });

  it("fails on missing report paths", () => {
    assert.match(parseArgs([]).error, /report/i);
  });
});

describe("parseReport", () => {
  it("parses anchors, enforces paired checkboxes, and counts unknown verbs", () => {
    const parsed = parseReport(makeReport());

    assert.equal(parsed.parsed.anchors, 8);
    assert.equal(parsed.parsed.checked, 5);
    assert.equal(parsed.parsed.unchecked, 3);
    assert.equal(parsed.parsed.unknown_verb, 1);
    assert.equal(parsed.frontmatter.generated, "2026-04-18");

    assert.equal(parsed.anchors[0].verb, "close");
    assert.equal(parsed.anchors[0].checked, true);
  });

  it("fails clearly on malformed anchor pairing", () => {
    assert.throws(
      () =>
        parseReport([
          "---",
          "generated: 2026-04-18",
          "---",
          "<!-- triage:close #42 reason=\"broken\" -->",
          "not a checkbox",
        ].join("\n")),
      /must be followed by a checkbox/i
    );
  });
});

describe("dedupActions", () => {
  it("dedups by normalized args and accepts a checked box in any location", () => {
    const parsed = parseReport(makeReport());
    const deduped = dedupActions(parsed.anchors);

    assert.equal(deduped.length, 5);

    const closeAction = deduped.find((action) => action.verb === "close");
    assert.equal(closeAction.checked, true);
    assert.equal(closeAction.occurrences.length, 2);

    const milestoneAction = deduped.find((action) => action.verb === "assign-milestone");
    assert.equal(milestoneAction.checked, true);

    const priorityAction = deduped.find((action) => action.verb === "set-priority");
    assert.deepEqual(priorityAction.normalizedArgs, {
      reason: "theme auth hot",
      value: "high",
    });
  });

  it("builds stable action keys from sorted, trimmed args", () => {
    const left = buildActionKey({
      verb: "assign-milestone",
      issueNumber: 42,
      args: { name: "Sprint W17", cluster: " auth " },
      normalizedArgs: normalizeArgs({ name: "Sprint W17", cluster: " auth " }),
    });
    const right = buildActionKey({
      verb: "assign-milestone",
      issueNumber: 42,
      args: { cluster: "auth", name: "Sprint W17" },
      normalizedArgs: normalizeArgs({ cluster: "auth", name: "Sprint W17" }),
    });

    assert.equal(left, right);
  });
});

describe("toGhCommands", () => {
  it("renders the MVP gh argv for every supported verb", () => {
    assert.deepEqual(
      toGhCommands({ verb: "close", issueNumber: 104, args: { reason: "stale cleanup" } }),
      [
        ["issue", "comment", "104", "-b", "stale cleanup"],
        ["issue", "close", "104"],
      ]
    );

    assert.deepEqual(
      toGhCommands({ verb: "revisit", issueNumber: 200, args: { reason: "needs product input" } }),
      [["issue", "comment", "200", "-b", "triage: revisit — needs product input"]]
    );

    assert.deepEqual(
      toGhCommands({
        verb: "close-duplicate",
        issueNumber: 103,
        args: { target: "#101", reason: "duplicate candidate converged" },
      }),
      [
        ["issue", "comment", "103", "-b", "Duplicate of #101. duplicate candidate converged"],
        ["issue", "close", "103", "-r", "not planned"],
      ]
    );

    assert.deepEqual(buildPriorityEditCommand(101, "high", ["priority:medium", "type:feature"]), [
      ["issue", "edit", "101", "--add-label", "priority:high", "--remove-label", "priority:medium"],
    ]);

    assert.deepEqual(
      toGhCommands(
        { verb: "set-priority", issueNumber: 101, args: { value: "high", reason: "theme auth hot" } },
        { currentPriorityLabels: ["priority:medium", "type:feature"] }
      ),
      [["issue", "edit", "101", "--add-label", "priority:high", "--remove-label", "priority:medium"]]
    );

    assert.deepEqual(
      toGhCommands({ verb: "assign-milestone", issueNumber: 102, args: { name: "Sprint W17" } }),
      [["issue", "edit", "102", "--milestone", "Sprint W17"]]
    );
    assert.deepEqual(
      toGhCommands({ verb: "assign-milestone", issueNumber: 102, args: { milestone: "Sprint W18" } }),
      [["issue", "edit", "102", "--milestone", "Sprint W18"]]
    );
  });
});

describe("execute", () => {
  let tempDir;
  let repoRoot;
  let reportPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-apply-"));
    repoRoot = path.join(tempDir, "repo");
    fs.mkdirSync(path.join(repoRoot, ".dev-backlog", "triage"), { recursive: true });
    reportPath = path.join(repoRoot, ".dev-backlog", "triage", "2026-04-18-report.md");
    fs.writeFileSync(reportPath, `${makeReport()}\n`);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("runs dry-run without invoking gh and emits pseudo commands", () => {
    const binDir = path.join(tempDir, "bin");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, "gh"),
      "#!/bin/sh\necho 'gh should not run in dry-run' >&2\nexit 99\n",
      { mode: 0o755 }
    );

    const stdout = execFileSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "triage-apply.js"), reportPath],
      {
        cwd: repoRoot,
        encoding: "utf-8",
        env: {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH}`,
        },
      }
    );

    assert.match(stdout, /DRY-RUN: gh issue comment 104/);
    assert.match(stdout, /DRY-RUN: gh issue view 101 --json labels/);
    assert.match(stdout, /DRY-RUN: gh issue close 103 -r 'not planned'/);
    assert.match(stdout, /SKIP: triage:future-action #999 \(unknown verb\)/);
    assert.match(stdout, /Summary: dry-run=4, applied=0, already-applied=0, skipped-pending=0, skipped-unknown-verb=1/);
  });

  it("emits machine-readable json in dry-run mode", () => {
    const stdout = execFileSync(
      process.execPath,
      [path.join(SKILL_SCRIPTS, "triage-apply.js"), reportPath, "--json"],
      {
        cwd: repoRoot,
        encoding: "utf-8",
      }
    );

    const parsed = JSON.parse(stdout);
    assert.equal(parsed.apply_mode, "dry-run");
    assert.equal(parsed.deduped, 5);
    assert.equal(parsed.actions.length, 4);
    assert.equal(parsed.skipped.length, 1);
    assert.deepEqual(parsed.actions[0].gh_argv, [
      ["issue", "comment", "104", "-b", "stale cleanup"],
      ["issue", "close", "104"],
    ]);
  });

  it("refuses non-interactive apply without --yes", () => {
    const result = execute([reportPath, "--apply"], {
      cwd: repoRoot,
      stdinIsTTY: false,
      stdoutIsTTY: false,
    });

    assert.equal(result.exitCode, 1);
    assert.match(result.error, /--yes/);
  });

  it("uses the log to skip already-applied actions and resumes partial close-duplicate runs", () => {
    const logPath = resolveLogPath("2026-04-18", repoRoot);
    fs.writeFileSync(
      logPath,
      [
        JSON.stringify({
          timestamp: "2026-04-18T07:00:00.000Z",
          issue: 104,
          verb: "close",
          args: { reason: "stale cleanup" },
          result: "applied",
          gh_argv: [["issue", "comment", "104", "-b", "stale cleanup"]],
        }),
        JSON.stringify({
          timestamp: "2026-04-18T07:00:01.000Z",
          issue: 104,
          verb: "close",
          args: { reason: "stale cleanup" },
          result: "applied",
          gh_argv: [["issue", "close", "104"]],
        }),
        JSON.stringify({
          timestamp: "2026-04-18T07:00:02.000Z",
          issue: 103,
          verb: "close-duplicate",
          args: { target: "#101", reason: "duplicate candidate converged" },
          result: "applied",
          gh_argv: [["issue", "comment", "103", "-b", "Duplicate of #101. duplicate candidate converged"]],
        }),
      ].join("\n") + "\n"
    );

    const calls = [];
    const result = execute([reportPath, "--apply", "--yes"], {
      cwd: repoRoot,
      now: () => "2026-04-18T08:00:00.000Z",
      runGh: (argv) => {
        calls.push(argv);
        if (argv[0] === "issue" && argv[1] === "view") {
          return {
            status: 0,
            stdout: JSON.stringify({ labels: [{ name: "priority:medium" }, { name: "type:feature" }] }),
            stderr: "",
          };
        }
        return {
          status: 0,
          stdout: "",
          stderr: "",
        };
      },
    });

    assert.equal(result.exitCode, 0);
    assert.deepEqual(calls, [
      ["issue", "view", "101", "--json", "labels"],
      ["issue", "edit", "101", "--add-label", "priority:high", "--remove-label", "priority:medium"],
      ["issue", "edit", "102", "--milestone", "Sprint W17"],
      ["issue", "close", "103", "-r", "not planned"],
    ]);

    const entries = fs
      .readFileSync(logPath, "utf-8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    assert.ok(entries.some((entry) => entry.result === "already-applied" && entry.issue === 104));
    assert.ok(entries.some((entry) => entry.result === "applied" && entry.issue === 101));
    assert.ok(entries.some((entry) => entry.result === "applied" && entry.issue === 103 && entry.gh_argv[0][1] === "close"));

    const replay = readApplyLog(logPath);
    const closeKey = buildActionKey({
      verb: "close",
      issueNumber: 104,
      args: { reason: "stale cleanup" },
      normalizedArgs: normalizeArgs({ reason: "stale cleanup" }),
    });
    assert.equal(replay.appliedCommandsByAction.get(closeKey).size, 2);
  });

  it("stops close-duplicate when the comment step fails and records stderr_tail", () => {
    const duplicateOnlyReport = path.join(repoRoot, ".dev-backlog", "triage", "duplicate-only.md");
    fs.writeFileSync(
      duplicateOnlyReport,
      [
        "---",
        "generated: 2026-04-18",
        "---",
        "<!-- triage:close-duplicate #103 target=#101 reason=\"duplicate candidate converged\" -->",
        "- [x] Close duplicate #103 into #101",
        "",
      ].join("\n")
    );

    const calls = [];
    const result = execute([duplicateOnlyReport, "--apply", "--yes"], {
      cwd: repoRoot,
      now: () => "2026-04-18T09:00:00.000Z",
      runGh: (argv) => {
        calls.push(argv);
        return {
          status: 1,
          stdout: "",
          stderr: "comment permission denied",
        };
      },
    });

    assert.equal(result.exitCode, 1);
    assert.match(result.error, /comment permission denied/);
    assert.deepEqual(calls, [["issue", "comment", "103", "-b", "Duplicate of #101. duplicate candidate converged"]]);

    const logLines = fs
      .readFileSync(resolveLogPath("2026-04-18", repoRoot), "utf-8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(logLines.at(-1).result, "error");
    assert.equal(logLines.at(-1).stderr_tail, "comment permission denied");
  });

  it("fails clearly when the report is missing", () => {
    const result = execute(["missing.md"], { cwd: repoRoot });
    assert.equal(result.exitCode, 1);
    assert.match(result.error, /failed to read report/i);
  });

  it("accepts canonical and legacy milestone keys and keeps re-runs idempotent", () => {
    fs.writeFileSync(reportPath, acceptedReport(
      '<!-- triage:assign-milestone #102 milestone="Sprint W17" -->',
      '<!-- triage:assign-milestone #103 name="Sprint W18" -->'
    ));
    const calls = [];
    const runGh = (argv) => {
      calls.push(argv);
      return { status: 0, stdout: "", stderr: "" };
    };
    const first = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh });
    const second = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh });

    assert.equal(first.exitCode, 0);
    assert.equal(second.exitCode, 0);
    assert.deepEqual(calls, [
      ["issue", "edit", "102", "--milestone", "Sprint W17"],
      ["issue", "edit", "103", "--milestone", "Sprint W18"],
    ]);
    assert.deepEqual(second.actions.map((action) => action.result), ["already-applied", "already-applied"]);
  });

  it("applies a report whose source anchors and checklist copies are all checked exactly once", () => {
    fs.writeFileSync(reportPath, makeReport().replace(/- \[ \]/g, "- [x]"));
    const calls = [];
    const runGh = (argv) => {
      calls.push(argv);
      return { status: 0, stdout: argv[1] === "view" ? '{"labels":[]}' : "", stderr: "" };
    };
    const result = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh });

    assert.equal(result.exitCode, 0);
    const writes = calls.filter((argv) => argv[1] !== "view").map((argv) => argv.slice(0, 3).join(" "));
    assert.deepEqual(writes.sort(), [
      "issue close 103",
      "issue close 104",
      "issue comment 103",
      "issue comment 104",
      "issue edit 101",
      "issue edit 102",
    ]);
  });

  it("rejects every invalid accepted action before any gh invocation or log write", () => {
    const cases = [
      ['<!-- triage:close #42 reason="  " -->', /reason is required/],
      ['<!-- triage:revisit #42 -->', /reason is required/],
      ['<!-- triage:set-priority #42 value=urgent -->', /value must be high/],
      ['<!-- triage:set-priority #42 -->', /value is required/],
      ['<!-- triage:close-duplicate #42 -->', /target is required/],
      ['<!-- triage:close-duplicate #42 target=43 -->', /target must be #N/],
      ['<!-- triage:close-duplicate #42 target=#42 -->', /target must not be the issue itself/],
      [`<!-- triage:close-duplicate #42 target=#${"9".repeat(59999)} -->`, /target must be #N/],
      ['<!-- triage:assign-milestone #42 milestone=" " -->', /milestone is required/],
      ['<!-- triage:assign-milestone #42 milestone="A" name="B" -->', /different values/],
      ['<!-- triage:close #0 reason="stale" -->', /issue number must be a positive safe integer/],
      ['<!-- triage:close #42 reason="first" reason="second" -->', /reason is given more than once/],
      ['<!-- triage:close #42 reason="stale" garbage -->', /unparsed argument text "garbage"/],
      ['<!-- triage:close #42 reason="bad\u0000reason" -->', /reason must not contain a NUL character/],
      ['<!-- triage:revisit #99999999999999999 reason="stale" -->', /issue number must be a positive safe integer/],
    ];
    const fixture = writeGhFixture(tempDir);
    const logPath = resolveLogPath("2026-04-18", repoRoot);
    for (const [anchor, expected] of cases) {
      fs.writeFileSync(reportPath, acceptedReport(anchor));
      const result = spawnSync(process.execPath, [path.join(SKILL_SCRIPTS, "triage-apply.js"), reportPath, "--apply", "--yes"], {
        cwd: repoRoot,
        encoding: "utf-8",
        env: fixture.env,
      });
      assert.equal(result.status, 1, anchor);
      assert.match(result.stderr, expected, anchor);
      assert.match(result.stderr, /line 4/, anchor);
      assert.equal(fixture.calls().length, 0, anchor);
      assert.equal(fs.existsSync(logPath), false, anchor);
    }
  });

  it("aggregates later invalid actions and conflicting assignments in apply and dry-run", () => {
    fs.writeFileSync(reportPath, acceptedReport(
      '<!-- triage:revisit #42 reason="valid" -->',
      '<!-- triage:set-priority #42 value=high -->',
      '<!-- triage:set-priority #42 value=low -->',
      '<!-- triage:assign-milestone #42 milestone="A" -->',
      '<!-- triage:assign-milestone #42 name="B" -->',
      '<!-- triage:close-duplicate #42 target=#40 -->',
      '<!-- triage:close-duplicate #42 target=#41 -->',
      '<!-- triage:close #43 reason=" " -->',
      '<!-- triage:close #0 reason="stale" -->',
      '<!-- triage:assign-milestone #44 milestone="A\u0000B" -->',
      `<!-- triage:close #45 reason="${"가".repeat(20001)}" -->`
    ));
    const fixture = writeGhFixture(tempDir);
    const logPath = resolveLogPath("2026-04-18", repoRoot);
    fs.writeFileSync(logPath, "existing log\n");
    for (const flags of [[], ["--apply", "--yes"]]) {
      const result = spawnSync(process.execPath, [path.join(SKILL_SCRIPTS, "triage-apply.js"), reportPath, ...flags], {
        cwd: repoRoot,
        encoding: "utf-8",
        env: fixture.env,
      });
      assert.equal(result.status, 1);
      for (const line of [10, 16, 22, 25, 28, 31, 34]) assert.match(result.stderr, new RegExp(`line ${line}:`));
      assert.match(result.stderr, /conflicting priority/);
      assert.match(result.stderr, /conflicting milestone/);
      assert.match(result.stderr, /conflicting duplicate target/);
      assert.match(result.stderr, /reason is required/);
      assert.match(result.stderr, /line 28: .*issue number must be a positive safe integer/);
      assert.match(result.stderr, /line 31: .*milestone must not contain a NUL character/);
      assert.match(result.stderr, /line 34: .*reason must be at most 60000 bytes/);
      assert.equal(fixture.calls().length, 0);
      assert.equal(fs.readFileSync(logPath, "utf-8"), "existing log\n");
    }
  });

  it("rejects a second accepted closing action for the same issue before any write", () => {
    const pairs = [
      ['<!-- triage:close #42 reason="stale" -->', '<!-- triage:close #42 reason="stale, no activity" -->'],
      ['<!-- triage:close-duplicate #42 target=#40 -->', '<!-- triage:close-duplicate #42 target=#40 reason="same bug" -->'],
      ['<!-- triage:close #42 reason="stale" -->', '<!-- triage:close-duplicate #42 target=#40 -->'],
    ];
    const fixture = writeGhFixture(tempDir);
    const logPath = resolveLogPath("2026-04-18", repoRoot);
    for (const [first, second] of pairs) {
      fs.writeFileSync(reportPath, acceptedReport(first, second));
      for (const flags of [[], ["--apply", "--yes"]]) {
        const result = spawnSync(process.execPath, [path.join(SKILL_SCRIPTS, "triage-apply.js"), reportPath, ...flags], {
          cwd: repoRoot,
          encoding: "utf-8",
          env: fixture.env,
        });
        assert.equal(result.status, 1, second);
        assert.match(result.stderr, /line 7: .*more than one accepted closing action for #42; line 4 already closes it/, second);
        assert.equal(fixture.calls().length, 0, second);
        assert.equal(fs.existsSync(logPath), false, second);
      }
    }
  });

  it("rejects a repeated same-value assignment, including the legacy milestone alias", () => {
    const pairs = [
      ['<!-- triage:assign-milestone #42 milestone="A" -->', '<!-- triage:assign-milestone #42 name="A" -->', /milestone "A" is already assigned on line 4/],
      ['<!-- triage:set-priority #42 value=high -->', '<!-- triage:set-priority #42 value=high reason="again" -->', /priority "high" is already assigned on line 4/],
    ];
    const fixture = writeGhFixture(tempDir);
    const logPath = resolveLogPath("2026-04-18", repoRoot);
    for (const [first, second, expected] of pairs) {
      fs.writeFileSync(reportPath, acceptedReport(first, second));
      const result = spawnSync(process.execPath, [path.join(SKILL_SCRIPTS, "triage-apply.js"), reportPath, "--apply", "--yes"], {
        cwd: repoRoot,
        encoding: "utf-8",
        env: fixture.env,
      });
      assert.equal(result.status, 1, second);
      assert.match(result.stderr, new RegExp(`line 7: .*${expected.source}`), second);
      assert.equal(fixture.calls().length, 0, second);
      assert.equal(fs.existsSync(logPath), false, second);
    }
  });

  it("leaves unchecked invalid anchors inert and unknown verbs skipped", () => {
    fs.writeFileSync(reportPath, [
      "---", "generated: 2026-04-18", "---",
      '<!-- triage:set-priority #42 value=urgent -->', "- [ ] Leave pending", "",
      '<!-- triage:future-action #42 -->', "- [x] Accept unknown", "",
    ].join("\n"));
    const result = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh: () => assert.fail("gh invoked") });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(result.skipped.map((entry) => entry.result), ["skipped-pending", "skipped-unknown-verb"]);
    assert.equal(fs.readFileSync(resolveLogPath("2026-04-18", repoRoot), "utf-8").trim().split("\n").length, 2);
  });

  it("guards the task authority before GitHub and apply log writes", () => {
    fs.writeFileSync(reportPath, acceptedReport('<!-- triage:assign-milestone #42 milestone="A" -->'));
    const tracker = path.join(repoRoot, ".dev-backlog", ".tracker");
    const calls = [];
    const runGh = (argv) => {
      calls.push(argv);
      return { status: 0, stdout: "", stderr: "" };
    };
    const logPath = resolveLogPath("2026-04-18", repoRoot);
    for (const value of ["backlog", "gitlab", "mystery", ""]) {
      fs.writeFileSync(tracker, `${value}\n`);
      const result = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh });
      assert.equal(result.exitCode, 1, value);
      assert.match(result.error, /authority/i);
      assert.equal(calls.length, 0);
      assert.equal(fs.existsSync(logPath), false);
    }
    fs.rmSync(tracker);
    fs.mkdirSync(tracker);
    const unreadable = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh });
    assert.equal(unreadable.exitCode, 1);
    assert.match(unreadable.error, /cannot read task authority/i);
    assert.equal(calls.length, 0);
    assert.equal(fs.existsSync(logPath), false);
    fs.rmdirSync(tracker);

    assert.equal(execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh }).exitCode, 0);
    assert.equal(calls.length, 1);
    fs.writeFileSync(tracker, "github\nignored second line\n");
    assert.equal(execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh }).exitCode, 0);
    assert.equal(calls.length, 1);
  });
});
