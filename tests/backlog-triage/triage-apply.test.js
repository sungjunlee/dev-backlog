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
    "Issue #104 is stale, and #103 duplicates #101.",
    "",
    "## Priority Proposals",
    "Issue #101 is part of the active auth cluster; #102 fits Sprint W17.",
    "",
    "## Apply Checklist",
    "<!-- triage:close #104 reason=\"stale cleanup\" -->",
    "- [x] Close #104 - stale cleanup",
    "",
    "<!-- triage:future-action #999 reason=\"wait for roadmap\" -->",
    "- [x] Future action #999 - wait for roadmap",
    "",
    "<!-- triage:set-priority #101 value=high reason=\"theme auth hot\" -->",
    "- [x] Set priority:high on #101 - theme auth hot",
    "",
    "<!-- triage:assign-milestone #102 cluster=auth name=\"Sprint W17\" -->",
    "- [x] Assign Sprint W17 to #102",
    "",
    "<!-- triage:close-duplicate #103 target=#101 reason=\"duplicate candidate converged\" -->",
    "- [x] Close duplicate #103 into #101",
    "",
  ].join("\n");
}

function acceptedReport(...anchors) {
  return [
    "---",
    "generated: 2026-04-18",
    "---",
    "## Apply Checklist",
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

    assert.equal(parsed.parsed.anchors, 5);
    assert.equal(parsed.parsed.checked, 5);
    assert.equal(parsed.parsed.unchecked, 0);
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
          "## Apply Checklist",
          "<!-- triage:close #42 reason=\"broken\" -->",
          "not a checkbox",
        ].join("\n")),
      /must be followed by a checkbox/i
    );
  });

  it("rejects checked or unchecked anchors outside the sole checklist with migration guidance", () => {
    for (const checkbox of ["x", " "]) {
      assert.throws(
        () => parseReport([
          "## Evidence",
          '<!-- triage:close #42 reason="old copy" -->',
          `- [${checkbox}] Old copy`,
          "## Apply Checklist",
          '<!-- triage:close #42 reason="old copy" -->',
          "- [x] Accept",
        ].join("\n")),
        (error) => {
          assert.match(error.message, /line 2.*outside ## Apply Checklist/);
          assert.match(error.message, /consolidate actions/i);
          assert.match(error.message, /explicitly recheck approvals/i);
          assert.match(error.message, /unchecking.*not sufficient/i);
          return true;
        }
      );
    }
  });

  it("requires exactly one checklist heading and rejects duplicate proposals within it", () => {
    assert.throws(() => parseReport("# Evidence only\n"), /exactly one ## Apply Checklist.*found 0/i);
    assert.throws(
      () => parseReport("## Apply Checklist\n## Apply Checklist\n"),
      /exactly one ## Apply Checklist.*lines 1, 2/i
    );
    assert.throws(
      () => parseReport([
        "## Apply Checklist",
        '<!-- triage:revisit #42 reason="owner needed" -->',
        "- [x] Accept",
        '<!-- triage:revisit #42 reason="owner needed" -->',
        "- [ ] Leave pending",
      ].join("\n")),
      /each proposal must appear once.*lines 2, 4.*explicitly recheck/i
    );
  });

  it("does not enforce the retired dev-backlog AC-marker protocol", () => {
    const report = parseReport([
      "<!-- AC:BEGIN -->",
      "evidence text",
      "<!-- AC:END -->",
      "## Apply Checklist",
      '<!-- triage:revisit #42 reason="owner needed" -->',
      "- [x] Accept",
    ].join("\n"));
    assert.equal(report.parsed.anchors, 1);
  });

  it("never treats frontmatter, code examples, or indented lookalikes as approvals", () => {
    const fakeHeadings = [
      [
        "---", "generated: 2026-04-18", "## Apply Checklist", "---",
        '<!-- triage:revisit #42 reason="owner needed" -->', "- [x] Accept",
      ],
      [
        "```markdown", "## Apply Checklist", "```",
        '<!-- triage:revisit #42 reason="owner needed" -->', "- [x] Accept",
      ],
      [
        "    ## Apply Checklist",
        '<!-- triage:revisit #42 reason="owner needed" -->', "- [x] Accept",
      ],
    ];
    for (const lines of fakeHeadings) {
      assert.throws(() => parseReport(lines.join("\n")), /anchor on line .*outside ## Apply Checklist/i);
    }

    assert.throws(
      () => parseReport([
        "## Apply Checklist",
        "```markdown",
        '<!-- triage:revisit #42 reason="example only" -->',
        "- [x] Example",
        "```",
      ].join("\n")),
      /anchor on line 3.*outside ## Apply Checklist/i
    );
    assert.throws(
      () => parseReport([
        "## Apply Checklist",
        '<!-- triage:revisit #42 reason="owner needed" -->',
        "    - [x] Indented code, not approval",
      ].join("\n")),
      /must be followed by a checkbox/i
    );
    const embedded = parseReport([
      "## Apply Checklist",
      '- <!-- triage:revisit #42 reason="example only" -->',
      "- [x] Example",
    ].join("\n"));
    assert.equal(embedded.parsed.anchors, 0);
  });

  it("never treats HTML comments or raw HTML blocks as approval context", () => {
    const anchor = '<!-- triage:revisit #42 reason="example only" -->';
    const literalReports = [
      ["<!--", "## Apply Checklist", "-->", anchor, "- [x] Example"],
      ["<!-- ## Apply Checklist -->", anchor, "- [x] Example"],
      ...["pre", "script", "style", "textarea", "div"].map((tag) => [
        `<${tag}>`, "## Apply Checklist", anchor, "- [x] Example", `</${tag}>`,
      ]),
    ];
    for (const lines of literalReports) {
      assert.throws(
        () => parseReport(lines.join("\n")),
        /anchor on line .*outside ## Apply Checklist/i,
        lines[0]
      );
    }

    const parsed = parseReport(["## Apply Checklist", anchor, "- [x] Accept"].join("\n"));
    assert.equal(parsed.anchors.length, 1, "a standalone triage anchor comment remains executable");
  });

  it("ends the checklist at Setext H1/H2 headings without mistaking thematic breaks for headings", () => {
    for (const underline of ["========", "--------"]) {
      assert.throws(
        () => parseReport([
          "## Apply Checklist",
          '<!-- triage:revisit #41 reason="inside" -->',
          "- [x] Accept",
          "",
          "Evidence",
          underline,
          '<!-- triage:revisit #42 reason="outside" -->',
          "- [x] Must reject",
        ].join("\n")),
        /anchor on line 7.*outside ## Apply Checklist/i
      );
    }

    const thematicBreak = parseReport([
      "## Apply Checklist",
      '<!-- triage:revisit #41 reason="first" -->',
      "- [x] Accept",
      "",
      "---",
      '<!-- triage:revisit #42 reason="second" -->',
      "- [x] Accept",
    ].join("\n"));
    assert.equal(thematicBreak.anchors.length, 2);

    for (const indentation of ["", " ", "  "]) {
      const thematicBreakAfterContinuation = parseReport([
        "## Apply Checklist",
        '<!-- triage:revisit #41 reason="first" -->',
        "- [x] Accept",
        `${indentation}checkbox continuation`,
        "---",
        '<!-- triage:revisit #42 reason="second" -->',
        "- [x] Accept",
      ].join("\n"));
      assert.equal(
        thematicBreakAfterContinuation.anchors.length,
        2,
        `${indentation.length}-space lazy continuation`
      );
    }
  });
});

describe("dedupActions", () => {
  it("keeps one normalized action for each checklist proposal", () => {
    const parsed = parseReport(makeReport());
    const deduped = dedupActions(parsed.anchors);

    assert.equal(deduped.length, 5);

    const closeAction = deduped.find((action) => action.verb === "close");
    assert.equal(closeAction.checked, true);
    assert.equal(closeAction.occurrences.length, 1);

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

  function executeWithEffectSpies(lines) {
    fs.writeFileSync(reportPath, lines.join("\n"));
    const effects = { provider: [], mkdir: 0, append: 0 };
    const result = execute([reportPath, "--apply", "--yes"], {
      cwd: repoRoot,
      runGh: (argv) => {
        effects.provider.push(argv);
        return { status: 0, stdout: "", stderr: "" };
      },
      mkdir: () => { effects.mkdir += 1; },
      appendFile: () => { effects.append += 1; },
    });
    return { result, effects };
  }

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
        "## Apply Checklist",
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

  it("applies exactly one action from the one approval surface", () => {
    fs.writeFileSync(reportPath, acceptedReport(
      '<!-- triage:revisit #104 reason="needs owner" -->'
    ));
    const calls = [];
    const runGh = (argv) => {
      calls.push(argv);
      return { status: 0, stdout: "", stderr: "" };
    };
    const result = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh });

    assert.equal(result.exitCode, 0);
    assert.deepEqual(calls, [["issue", "comment", "104", "-b", "triage: revisit — needs owner"]]);
  });

  it("rejects an outside anchor before any GitHub call or log write", () => {
    fs.writeFileSync(reportPath, [
      "---", "generated: 2026-04-18", "---",
      "## Evidence",
      '<!-- triage:revisit #104 reason="old copy" -->',
      "- [ ] Old unchecked copy",
      "## Apply Checklist",
      '<!-- triage:revisit #104 reason="old copy" -->',
      "- [x] Accept",
    ].join("\n"));
    const logPath = resolveLogPath("2026-04-18", repoRoot);
    fs.writeFileSync(logPath, "preserve history exactly\n");
    const result = execute([reportPath, "--apply", "--yes"], {
      cwd: repoRoot,
      runGh: () => assert.fail("GitHub invoked"),
    });

    assert.equal(result.exitCode, 1);
    assert.match(result.error, /line 5.*outside ## Apply Checklist/);
    assert.equal(fs.readFileSync(logPath, "utf8"), "preserve history exactly\n");
  });

  it("rejects HTML-hidden approvals before any GitHub call or log write", () => {
    const reports = [
      [
        "---", "generated: 2026-04-18", "---",
        "<!--", "## Apply Checklist", "-->",
        '<!-- triage:revisit #104 reason="comment wrapped" -->',
        "- [x] Accept",
      ],
      [
        "---", "generated: 2026-04-18", "---",
        "<pre>", "## Apply Checklist",
        '<!-- triage:revisit #104 reason="pre wrapped" -->',
        "- [x] Accept", "</pre>",
      ],
    ];
    const calls = [];
    const logPath = resolveLogPath("2026-04-18", repoRoot);
    for (const lines of reports) {
      fs.writeFileSync(reportPath, lines.join("\n"));
      const result = execute([reportPath, "--apply", "--yes"], {
        cwd: repoRoot,
        runGh: (argv) => {
          calls.push(argv);
          return { status: 0, stdout: "", stderr: "" };
        },
      });
      assert.equal(result.exitCode, 1);
      assert.match(result.error, /outside ## Apply Checklist/i);
      assert.deepEqual(calls, []);
      assert.equal(fs.existsSync(logPath), false);
    }
  });

  it("rejects list-contained HTML approvals before provider or preflight log effects", () => {
    const reports = [
      [
        "- <pre>",
        "  ## Apply Checklist",
        '  <!-- triage:revisit #42 reason="hidden" -->',
        "  - [x] Must reject",
        "  </pre>",
      ],
      [
        "- <!--",
        "  ## Apply Checklist",
        "  -->",
        '  <!-- triage:revisit #42 reason="hidden" -->',
        "  - [x] Must reject",
      ],
    ];

    for (const lines of reports) {
      fs.writeFileSync(reportPath, lines.join("\n"));
      const providerCalls = [];
      let appendCalls = 0;
      const result = execute([reportPath, "--apply", "--yes"], {
        cwd: repoRoot,
        runGh: (argv) => {
          providerCalls.push(argv);
          return { status: 0, stdout: "", stderr: "" };
        },
        appendFile: () => { appendCalls += 1; },
      });

      assert.notEqual(result.exitCode, 0, lines[0]);
      assert.deepEqual(providerCalls, [], lines[0]);
      assert.equal(appendCalls, 0, `${lines[0]} must reject before apply-log preflight`);
    }
  });

  it("rejects HTML opened on a continued list container before every effect", () => {
    const reports = [
      {
        anchorLine: 5,
        lines: [
          "- Evidence",
          "",
          "    <pre>",
          "  ## Apply Checklist",
          '  <!-- triage:revisit #42 reason="outside" -->',
          "  - [x] Must reject",
          "    </pre>",
        ],
      },
      {
        anchorLine: 6,
        lines: [
          "- Evidence",
          "",
          "    <!--",
          "  ## Apply Checklist",
          "  -->",
          '<!-- triage:revisit #42 reason="outside" -->',
          "- [x] Must reject",
        ],
      },
    ];

    for (const { anchorLine, lines } of reports) {
      const { result, effects } = executeWithEffectSpies(lines);
      assert.notEqual(result.exitCode, 0, lines[2]);
      assert.match(result.error, new RegExp(`anchor on line ${anchorLine}.*outside ## Apply Checklist`, "i"));
      assert.deepEqual(effects, { provider: [], mkdir: 0, append: 0 }, lines[2]);
    }
  });

  it("requires exact type-1 HTML closing tags before every effect", () => {
    for (const closer of ["</pre >", "</pre\t>"]) {
      for (const listContained of [false, true]) {
        const indent = listContained ? "  " : "";
        const lines = [
          listContained ? "- <pre>" : "<pre>",
          `${indent}${closer}`,
          `${indent}## Apply Checklist`,
          `${indent}<!-- triage:revisit #42 reason="outside" -->`,
          `${indent}- [x] Must reject`,
          `${indent}</pre>`,
        ];
        const { result, effects } = executeWithEffectSpies(lines);
        assert.notEqual(result.exitCode, 0, `${closer} / list=${listContained}`);
        assert.match(result.error, /anchor on line 4.*outside ## Apply Checklist/i);
        assert.deepEqual(
          effects,
          { provider: [], mkdir: 0, append: 0 },
          `${closer} / list=${listContained}`
        );
      }
    }

    const control = executeWithEffectSpies([
      "<pre>",
      "literal example",
      "</pre>",
      "## Apply Checklist",
      '<!-- triage:revisit #42 reason="accepted" -->',
      "- [x] Accept",
    ]);
    assert.equal(control.result.exitCode, 0);
    assert.deepEqual(control.effects.provider, [
      ["issue", "comment", "42", "-b", "triage: revisit — accepted"],
    ]);
  });

  it("rejects anchors after a Setext section boundary before effects", () => {
    fs.writeFileSync(reportPath, [
      "---", "generated: 2026-04-18", "---",
      "## Apply Checklist",
      '<!-- triage:revisit #103 reason="inside" -->',
      "- [x] Accept",
      "",
      "Evidence",
      "--------",
      '<!-- triage:revisit #104 reason="outside" -->',
      "- [x] Must reject",
    ].join("\n"));
    const calls = [];
    const logPath = resolveLogPath("2026-04-18", repoRoot);
    const result = execute([reportPath, "--apply", "--yes"], {
      cwd: repoRoot,
      runGh: (argv) => {
        calls.push(argv);
        return { status: 0, stdout: "", stderr: "" };
      },
    });

    assert.equal(result.exitCode, 1);
    assert.match(result.error, /anchor on line 10.*outside ## Apply Checklist/i);
    assert.deepEqual(calls, []);
    assert.equal(fs.existsSync(logPath), false);
  });

  it("rejects anchors after multiline Setext H1/H2 boundaries before effects", () => {
    const reports = [];
    for (const continuation of ["    continued", "2. More evidence"]) {
      for (const underline of ["===", "---"]) {
        reports.push([
          "## Apply Checklist",
          "",
          "Evidence",
          continuation,
          underline,
          '<!-- triage:revisit #42 reason="outside" -->',
          "- [x] Must reject",
        ]);
      }
    }

    for (const lines of reports) {
      fs.writeFileSync(reportPath, lines.join("\n"));
      const providerCalls = [];
      let appendCalls = 0;
      const result = execute([reportPath, "--apply", "--yes"], {
        cwd: repoRoot,
        runGh: (argv) => {
          providerCalls.push(argv);
          return { status: 0, stdout: "", stderr: "" };
        },
        appendFile: () => { appendCalls += 1; },
      });

      assert.notEqual(result.exitCode, 0, `${lines[3]} / ${lines[4]}`);
      assert.match(result.error, /anchor on line 6.*outside ## Apply Checklist/i);
      assert.deepEqual(providerCalls, [], `${lines[3]} / ${lines[4]}`);
      assert.equal(appendCalls, 0, `${lines[3]} / ${lines[4]} must reject before apply-log preflight`);
    }
  });

  it("ends the checklist at Setext headings immediately after indented code", () => {
    for (const underline of ["===", "---"]) {
      const { result, effects } = executeWithEffectSpies([
        "## Apply Checklist",
        "",
        "    code sample",
        "Evidence",
        underline,
        '<!-- triage:revisit #42 reason="outside" -->',
        "- [x] Must reject",
      ]);

      assert.notEqual(result.exitCode, 0, underline);
      assert.match(result.error, /anchor on line 6.*outside ## Apply Checklist/i);
      assert.deepEqual(effects, { provider: [], mkdir: 0, append: 0 }, underline);
    }
  });

  it("preflights the actual apply-log append path before provider effects", () => {
    fs.writeFileSync(reportPath, acceptedReport(
      '<!-- triage:revisit #104 reason="needs owner" -->'
    ));
    const calls = [];
    const result = execute([reportPath, "--apply", "--yes"], {
      cwd: repoRoot,
      runGh: (argv) => {
        calls.push(argv);
        return { status: 0, stdout: "", stderr: "" };
      },
      appendFile: () => {
        const error = new Error("permission denied");
        error.code = "EACCES";
        throw error;
      },
    });

    assert.equal(result.exitCode, 1);
    assert.match(result.error, /apply log is not appendable/i);
    assert.match(result.error, /permission denied/);
    assert.deepEqual(calls, []);
  });

  it("stops and reports an uncertain effect when append fails after provider success", () => {
    fs.writeFileSync(reportPath, acceptedReport(
      '<!-- triage:close #104 reason="stale cleanup" -->'
    ));
    const calls = [];
    let appendCount = 0;
    const result = execute([reportPath, "--apply", "--yes"], {
      cwd: repoRoot,
      runGh: (argv) => {
        calls.push(argv);
        return { status: 0, stdout: "", stderr: "" };
      },
      appendFile: (target, content) => {
        appendCount += 1;
        if (appendCount === 1) return fs.appendFileSync(target, content);
        const error = new Error("injected ledger failure");
        error.code = "EIO";
        throw error;
      },
    });

    assert.equal(result.exitCode, 1);
    assert.deepEqual(calls, [["issue", "comment", "104", "-b", "stale cleanup"]]);
    assert.match(result.error, /gh issue comment 104 -b 'stale cleanup'/);
    assert.match(result.error, /effect may have completed/i);
    assert.match(result.error, /verify remote state before manual recovery/i);
    assert.match(result.error, /do not blindly rerun/i);
    assert.equal(fs.readFileSync(resolveLogPath("2026-04-18", repoRoot), "utf8"), "");
  });

  it("treats the legacy milestone alias as the canonical key across migrated reruns", () => {
    const calls = [];
    const runGh = (argv) => {
      calls.push(argv);
      return { status: 0, stdout: "", stderr: "" };
    };
    fs.writeFileSync(reportPath, acceptedReport(
      '<!-- triage:assign-milestone #102 name="Sprint W17" -->'
    ));
    const first = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh });
    fs.writeFileSync(reportPath, acceptedReport('<!-- triage:assign-milestone #102 milestone="Sprint W17" -->'));
    const second = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh });

    assert.equal(first.exitCode, 0);
    assert.equal(second.exitCode, 0);
    assert.deepEqual(calls, [["issue", "edit", "102", "--milestone", "Sprint W17"]]);
    assert.deepEqual(second.actions.map((action) => action.result), ["already-applied"]);
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
      assert.match(result.stderr, /line 5/, anchor);
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
      `<!-- triage:close #45 reason="${"가".repeat(5334)}" -->`
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
      for (const line of [11, 17, 23, 26, 29, 32, 35]) assert.match(result.stderr, new RegExp(`line ${line}:`));
      assert.match(result.stderr, /conflicting priority/);
      assert.match(result.stderr, /conflicting milestone/);
      assert.match(result.stderr, /conflicting duplicate target/);
      assert.match(result.stderr, /reason is required/);
      assert.match(result.stderr, /line 29: .*issue number must be a positive safe integer/);
      assert.match(result.stderr, /line 32: .*milestone must not contain a NUL character/);
      assert.match(result.stderr, /line 35: .*reason must be at most 16000 bytes/);
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
        assert.match(result.stderr, /line 8: .*more than one accepted closing action for #42; line 5 already closes it/, second);
        assert.equal(fixture.calls().length, 0, second);
        assert.equal(fs.existsSync(logPath), false, second);
      }
    }
  });

  it("rejects a repeated same-value assignment that differs in other arguments, including the legacy alias", () => {
    const pairs = [
      ['<!-- triage:assign-milestone #42 milestone="A" reason="one" -->', '<!-- triage:assign-milestone #42 name="A" reason="two" -->', /milestone "A" is already assigned on line 5/],
      ['<!-- triage:set-priority #42 value=high -->', '<!-- triage:set-priority #42 value=high reason="again" -->', /priority "high" is already assigned on line 5/],
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
      assert.match(result.stderr, new RegExp(`line 8: .*${expected.source}`), second);
      assert.equal(fixture.calls().length, 0, second);
      assert.equal(fs.existsSync(logPath), false, second);
    }
  });

  it("leaves unchecked invalid anchors inert and unknown verbs skipped", () => {
    fs.writeFileSync(reportPath, [
      "---", "generated: 2026-04-18", "---",
      "## Apply Checklist",
      '<!-- triage:set-priority #42 value=urgent -->', "- [ ] Leave pending", "",
      '<!-- triage:future-action #42 -->', "- [x] Accept unknown", "",
    ].join("\n"));
    const result = execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh: () => assert.fail("gh invoked") });
    assert.equal(result.exitCode, 0);
    assert.deepEqual(result.skipped.map((entry) => entry.result), ["skipped-pending", "skipped-unknown-verb"]);
    assert.equal(fs.readFileSync(resolveLogPath("2026-04-18", repoRoot), "utf-8").trim().split("\n").length, 2);
  });

  it("outcome triage-apply-github-only: stops before GitHub and apply-log writes", () => {
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
    fs.writeFileSync(tracker, "\uFEFFGitHub\r\nbacklog\r\n");
    assert.equal(execute([reportPath, "--apply", "--yes"], { cwd: repoRoot, runGh }).exitCode, 0);
    assert.equal(calls.length, 1);
  });
});
