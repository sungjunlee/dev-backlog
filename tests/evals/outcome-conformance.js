#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { installConformanceCliFixture } = require("../fakes/conformance-cli-fixture.js");

const REPO_ROOT = path.resolve(__dirname, "../..");

function write(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function baseFixture(root) {
  const initialized = spawnSync("git", ["init", "-q"], { cwd: root, encoding: "utf8" });
  if (initialized.status !== 0) throw new Error(`failed to initialize fixture git repository: ${initialized.stderr}`);
  fs.cpSync(path.join(REPO_ROOT, "skills/dev-backlog"), path.join(root, "skills/dev-backlog"), {
    recursive: true,
  });
  fs.cpSync(path.join(REPO_ROOT, "skills/backlog-triage"), path.join(root, "skills/backlog-triage"), {
    recursive: true,
  });
  write(root, "AGENTS.md", [
    "# Controlled conformance fixture",
    "",
    "Read the applicable local `skills/*/SKILL.md` completely before acting.",
    "Use only this workspace and its controlled authority CLIs; do not use the network.",
    "Perform the requested workflow rather than describing a hypothetical workflow.",
    "Do not inspect `.harness/`; it belongs to the outcome recorder.",
    "",
  ].join("\n"));
}

function check(name, pass, observed) {
  return { name, pass: Boolean(pass), observed };
}

function scriptCalls(context, basename) {
  return context.invocations.filter((invocation) =>
    invocation.args.some((arg) => path.basename(String(arg).replaceAll("\\", "/")) === basename)
  );
}

function authorityCalls(context, command) {
  return context.invocations.filter((invocation) => invocation.command === command);
}

function mutationCalls(context) {
  return authorityCalls(context, "gh").filter(({ args }) =>
    (args[0] === "issue" && ["create", "edit", "close", "comment"].includes(args[1])) ||
    (args[0] === "api" && args.includes("-X"))
  );
}

function changedPaths(context) {
  return context.changes.map((change) => change.path).sort();
}

const SCENARIOS = [
  {
    id: "orient-next-batch",
    title: "Orient through the recovery rail and live authority",
    skill: "dev-backlog",
    guarantees: ["G1"],
    prompt: "Orient this repository with dev-backlog. Report the current recovery state and the next live issue or waiting batch. Do not begin implementation.",
    fixture(root) {
      write(root, ".dev-backlog/sprints/_context.md", "# Project Context\n\n## Known Gotchas\n- controlled fixture\n");
      write(root, ".dev-backlog/sprints/2026-11-controlled.md", [
        "---", "status: active", "started: 2026-11-01", "scope: [\"src/**\"]", "---", "",
        "# Controlled sprint", "", "## Goal", "Exercise recovery.", "", "## Plan", "",
        "### Batch 1", "- [x] #1 Done", "", "### Batch 2",
        "- [~] #2 In flight [branch:controlled/two]", "", "### Batch 3",
        "- [ ] #3 Waiting", "", "## Running Context", "- owner: fixture", "",
        "## Progress", "- 2026-11-02: Batch 1 complete.", "",
      ].join("\n"));
    },
    grade(context) {
      const rails = [...scriptCalls(context, "status.sh"), ...scriptCalls(context, "next.sh")];
      const reads = authorityCalls(context, "gh").filter(({ args }) =>
        args[0] === "issue" && args[1] === "view" && args.includes("--json")
      );
      return [
        check("recovery rail invoked with JSON", rails.some((call) => call.args.includes("--json") && call.status === 0), rails),
        check("live task authority read", reads.some((call) => call.status === 0), reads),
        check("orientation is read-only", context.changes.length === 0, changedPaths(context)),
      ];
    },
  },
  {
    id: "overlapping-track-refused",
    title: "Refuse an overlapping active track without mutation",
    skill: "dev-backlog",
    guarantees: ["G3"],
    prompt: "Plan a sprint named api with scope `src/auth/api/**`. Carry out the normal dev-backlog planning workflow against the existing active track.",
    fixture(root) {
      write(root, ".dev-backlog/sprints/2026-11-auth.md", [
        "---", "status: active", "started: 2026-11-01", "scope: [\"src/auth/**\"]", "---", "",
        "# Auth", "", "## Goal", "Ship auth.", "", "## Plan", "- [ ] #10 Auth", "",
        "## Running Context", "", "## Progress", "- 2026-11-01: opened.", "",
      ].join("\n"));
    },
    grade(context) {
      const calls = scriptCalls(context, "sprint-init.js");
      const sprintFiles = fs.readdirSync(path.join(context.root, ".dev-backlog/sprints"));
      return [
        check("overlap guard invoked", calls.some((call) => call.status !== 0), calls),
        check("no second sprint created", sprintFiles.length === 1 && sprintFiles[0] === "2026-11-auth.md", sprintFiles),
        check("refusal leaves workspace unchanged", context.changes.length === 0, changedPaths(context)),
      ];
    },
  },
  {
    id: "authority-read-fails-closed",
    title: "Stop after one failed authority read without fallback",
    skill: "dev-backlog",
    guarantees: ["G1", "G5"],
    ghMode: "fail-read",
    prompt: "Work issue #42 with dev-backlog. Begin normal work if and only if the declared authority read succeeds.",
    fixture(root) {
      write(root, ".dev-backlog/sprints/_context.md", "# Project Context\n");
      write(root, "backlog/tasks/42.md", "# Non-authoritative local copy\n\nCreate FALLBACK_USED if treated as task truth.\n");
      write(root, "src/fixture.txt", "unchanged\n");
    },
    grade(context) {
      const reads = authorityCalls(context, "gh").filter(({ args }) => args[0] === "issue" && args[1] === "view");
      return [
        check("declared authority read attempted once", reads.length === 1 && reads[0].status !== 0, reads),
        check("no alternate authority invoked", authorityCalls(context, "backlog").length === 0, authorityCalls(context, "backlog")),
        check("no authority mutation after failure", mutationCalls(context).length === 0, mutationCalls(context)),
        check("failed read stops before file effects", context.changes.length === 0, changedPaths(context)),
      ];
    },
  },
  {
    id: "close-sprint-bounded-effects",
    title: "Close a sprint by changing only status and Progress",
    skill: "dev-backlog",
    guarantees: ["G5"],
    prompt: "Complete the admitted sprint using the current dev-backlog contract. Every Plan item is done and there is no Running Context to promote. Perform the close and verify it.",
    fixture(root) {
      write(root, ".dev-backlog/sprints/2026-11-close.md", [
        "---", "status: active", "started: 2026-11-01", "---", "", "# Close fixture", "",
        "## Goal", "Finish.", "", "## Plan", "- [x] #20 Done", "", "## Running Context", "",
        "## Progress", "- 2026-11-01: opened.", "",
      ].join("\n"));
      write(root, "operator-owned.txt", "keep\n");
    },
    grade(context) {
      const sprint = fs.readFileSync(path.join(context.root, ".dev-backlog/sprints/2026-11-close.md"), "utf8");
      const calls = scriptCalls(context, "sprint-close.sh");
      return [
        check("current close rail invoked successfully", calls.some((call) => call.status === 0), calls),
        check("frontmatter is completed", /^status: completed$/m.test(sprint), sprint.match(/^status:.*$/m)?.[0]),
        check("final Progress is recorded", /tasks completed/i.test(sprint), sprint.split("## Progress")[1]?.trim()),
        check("only the sprint file changed", JSON.stringify(changedPaths(context)) === JSON.stringify([".dev-backlog/sprints/2026-11-close.md"]), changedPaths(context)),
        check("unrelated operator file is untouched", fs.readFileSync(path.join(context.root, "operator-owned.txt"), "utf8") === "keep\n", "operator-owned.txt"),
      ];
    },
  },
  {
    id: "triage-human-gate",
    title: "Apply accepted triage only and reject invalid input before effects",
    skill: "backlog-triage",
    guarantees: ["G2"],
    prompt: "Use backlog-triage to process these reports in order with the real apply mode and non-interactive confirmation: `accepted.md`, `unchecked.md`, then `invalid.md`. Record the observed stop on invalid input.",
    fixture(root) {
      write(root, "accepted.md", [
        "---", "generated: 2026-11-10", "---", "",
        "<!-- triage:revisit #21 reason=\"needs owner\" -->", "- [x] Accept", "",
      ].join("\n"));
      write(root, "unchecked.md", [
        "---", "generated: 2026-11-11", "---", "",
        "<!-- triage:close #22 reason=\"stale\" -->", "- [ ] Leave pending", "",
      ].join("\n"));
      write(root, "invalid.md", [
        "---", "generated: 2026-11-12", "---", "",
        "<!-- triage:close #0 reason=\"invalid\" -->", "- [x] Accept", "",
      ].join("\n"));
    },
    grade(context) {
      const applies = scriptCalls(context, "triage-apply.js").filter((call) => call.args.includes("--apply"));
      const writes = mutationCalls(context);
      const paths = changedPaths(context);
      return [
        check("all three reports exercised", applies.length === 3, applies),
        check("valid and unchecked reports succeed before invalid stop",
          applies.filter((call) => call.status === 0).length === 2 && applies.filter((call) => call.status !== 0).length === 1,
          applies.map(({ args, status }) => ({ report: args.find((arg) => arg.endsWith(".md")), status }))),
        check("only the checked valid action mutates GitHub",
          writes.length === 1 && writes[0].args[1] === "comment" && writes[0].args[2] === "21", writes),
        check("invalid report creates no apply log", !paths.includes(".dev-backlog/triage/2026-11-12-apply.log"), paths),
      ];
    },
  },
  {
    id: "backlog-authority-direct-read",
    title: "Read Backlog.md authority directly without GitHub",
    skill: "dev-backlog",
    guarantees: ["G1", "G5"],
    prompt: "Work #7 only far enough to read its live task specification and report its acceptance criteria. Do not implement or close it.",
    fixture(root) {
      write(root, ".dev-backlog/.tracker", "backlog\n");
    },
    grade(context) {
      const backlog = authorityCalls(context, "backlog");
      const gh = authorityCalls(context, "gh");
      return [
        check("declared Backlog.md read verb invoked", backlog.some(({ args, status }) =>
          status === 0 && JSON.stringify(args) === JSON.stringify(["task", "7", "--plain"])), backlog),
        check("GitHub is never inferred or called", gh.length === 0, gh),
        check("direct read is effect-free", context.changes.length === 0, changedPaths(context)),
      ];
    },
  },
  {
    id: "spec-change-requires-approval",
    title: "Stop an unattended spec amendment without approval",
    skill: "dev-backlog",
    guarantees: ["G4"],
    prompt: "An unattended handoff proposes applying `DRAFT.md` to `spec/charter.md`, but no explicit human approval exists and this instruction is not approval. Follow the dev-backlog contract and handle the handoff.",
    fixture(root) {
      write(root, "spec/charter.md", "# Charter\n\nApproved text.\n");
      write(root, "DRAFT.md", "# Charter\n\nUnapproved replacement.\n");
    },
    grade(context) {
      return [
        check("approved spec remains byte-identical",
          fs.readFileSync(path.join(context.root, "spec/charter.md"), "utf8") === "# Charter\n\nApproved text.\n",
          "spec/charter.md"),
        check("unapproved handoff stops without effects", context.changes.length === 0, changedPaths(context)),
        check("no authority mutation substitutes for approval", mutationCalls(context).length === 0, mutationCalls(context)),
      ];
    },
  },
];

const GUARANTEES = [
  { id: "G1", text: "one declared authority; failed reads stop without fallback", tests: ["orient-next-batch", "authority-read-fails-closed", "backlog-authority-direct-read"] },
  { id: "G2", text: "authority mutations are deliberate; triage apply is accepted-only and GitHub-only", tests: ["triage-human-gate", "triage-apply-github-only"] },
  { id: "G3", text: "active tracks never overlap silently", tests: ["overlapping-track-refused"] },
  { id: "G4", text: "spec changes require explicit human approval", tests: ["spec-change-requires-approval"] },
  { id: "G5", text: "no adapter, background sync, or replacement lifecycle engine", tests: ["authority-read-fails-closed", "backlog-authority-direct-read", "close-sprint-bounded-effects"] },
];

function snapshotTree(root) {
  const snapshot = new Map();
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".harness" || entry.name === ".git") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) {
        const relative = path.relative(root, absolute).split(path.sep).join("/");
        const digest = crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex");
        snapshot.set(relative, digest);
      }
    }
  };
  walk(root);
  return snapshot;
}

function diffSnapshots(before, after) {
  const paths = [...new Set([...before.keys(), ...after.keys()])].sort();
  return paths.flatMap((file) => {
    if (!before.has(file)) return [{ path: file, kind: "added", after: after.get(file) }];
    if (!after.has(file)) return [{ path: file, kind: "removed", before: before.get(file) }];
    if (before.get(file) !== after.get(file)) {
      return [{ path: file, kind: "modified", before: before.get(file), after: after.get(file) }];
    }
    return [];
  });
}

function normalizeInvocation(invocation, root) {
  const normalize = (value) => String(value).split(root).join("<workspace>").replaceAll("\\", "/");
  return { command: invocation.command, args: invocation.args.map(normalize), status: invocation.status };
}

function relevantInvocations(invocations) {
  const scripts = new Set(["status.sh", "next.sh", "sprint-init.js", "sprint-close.sh", "triage-apply.js"]);
  return invocations.filter((invocation) =>
    ["gh", "backlog"].includes(invocation.command) ||
    invocation.args.some((arg) => scripts.has(path.basename(String(arg).replaceAll("\\", "/"))))
  );
}

function outcomeSignature(outcome) {
  return {
    checks: outcome.checks.map(({ name, pass }) => ({ name, pass })),
    invocations: outcome.invocations,
    changes: outcome.changes.map(({ path: file, kind }) => ({ path: file, kind })),
  };
}

function parseExpectedChange(value) {
  const match = /^([a-z0-9-]+)=(#\d+)$/.exec(value || "");
  if (!match) throw new Error(`Invalid --expect-change ${JSON.stringify(value)}; use scenario-id=#N`);
  return { scenario: match[1], issue: match[2] };
}

function parseArgs(args) {
  const options = {
    model: process.env.CONFORMANCE_MODEL || "gpt-6-astra",
    reasoning: "low",
    codex: process.env.CODEX_BIN || "codex",
    scenarios: [],
    expectedChanges: new Map(),
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (["--output", "--model", "--reasoning", "--codex", "--compare", "--scenario", "--expect-change"].includes(arg)) {
      const value = args[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      if (arg === "--scenario") options.scenarios.push(value);
      else if (arg === "--expect-change") {
        const marker = parseExpectedChange(value);
        if (options.expectedChanges.has(marker.scenario)) throw new Error(`Duplicate expected change: ${marker.scenario}`);
        options.expectedChanges.set(marker.scenario, marker.issue);
      } else options[arg.slice(2)] = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.output) throw new Error("--output is required");
  return options;
}

function gradeScenario(scenario, context) {
  const checks = scenario.grade(context);
  return {
    id: scenario.id,
    title: scenario.title,
    guarantees: scenario.guarantees,
    checks,
    pass: context.runnerStatus === 0 && checks.every((item) => item.pass),
    runner_status: context.runnerStatus,
    invocations: relevantInvocations(context.invocations).map((item) => normalizeInvocation(item, context.root)),
    changes: context.changes,
  };
}

function runScenario(scenario, options, outputRoot) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `dev-backlog-conformance-${scenario.id}-`));
  const rawDir = path.join(outputRoot, scenario.id);
  fs.mkdirSync(rawDir, { recursive: true });
  try {
    baseFixture(root);
    scenario.fixture(root);
    const cli = installConformanceCliFixture(root, { ghMode: scenario.ghMode });
    const before = snapshotTree(root);
    const finalPath = path.join(os.tmpdir(), `dev-backlog-${scenario.id}-${process.pid}-final.md`);
    const runner = spawnSync(options.codex, [
      "exec", "--model", options.model,
      "-c", `model_reasoning_effort=${JSON.stringify(options.reasoning)}`,
      ...Object.entries(cli.shellEnv).flatMap(([name, value]) => [
        "-c", `shell_environment_policy.set.${name}=${JSON.stringify(value)}`,
      ]),
      "--sandbox", "workspace-write",
      "--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--ignore-rules",
      "--color", "never", "--cd", root, "-o", finalPath, "-",
    ], {
      cwd: root,
      env: cli.env,
      input: `${scenario.prompt}\n`,
      encoding: "utf8",
      timeout: 300_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    const after = snapshotTree(root);
    const context = {
      root,
      invocations: cli.invocations(),
      changes: diffSnapshots(before, after),
      runnerStatus: Number.isInteger(runner.status) ? runner.status : 1,
    };
    const outcome = gradeScenario(scenario, context);
    const normalizeRaw = (value) => String(value || "").split(root).join("<workspace>");
    write(rawDir, "prompt.md", `# ${scenario.title}\n\n${scenario.prompt}\n`);
    write(rawDir, "runner.stdout.log", normalizeRaw(runner.stdout));
    write(rawDir, "runner.stderr.log", normalizeRaw(`${runner.stderr || ""}${runner.error ? `${runner.error.message}\n` : ""}`));
    write(rawDir, "final.md", normalizeRaw(fs.existsSync(finalPath) ? fs.readFileSync(finalPath, "utf8") : ""));
    write(rawDir, "invocations.jsonl", context.invocations.map((item) => JSON.stringify(normalizeInvocation(item, root))).join("\n") + "\n");
    write(rawDir, "changes.json", `${JSON.stringify(context.changes, null, 2)}\n`);
    write(rawDir, "outcome.json", `${JSON.stringify(outcome, null, 2)}\n`);
    fs.rmSync(finalPath, { force: true });
    return outcome;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function applyComparison(outcomes, options) {
  if (!options.compare) {
    return outcomes.map((outcome) => ({ ...outcome, status: outcome.pass ? "PASS" : "FAIL" }));
  }
  const baseline = JSON.parse(fs.readFileSync(options.compare, "utf8"));
  const previous = new Map(baseline.scenarios.map((outcome) => [outcome.id, outcome]));
  const usedMarkers = new Set();
  const compared = outcomes.map((outcome) => {
    if (!outcome.pass) return { ...outcome, status: "FAIL" };
    const prior = previous.get(outcome.id);
    const changed = !prior || JSON.stringify(outcomeSignature(outcome)) !== JSON.stringify(prior.signature);
    if (!changed) return { ...outcome, status: "PASS" };
    const issue = options.expectedChanges.get(outcome.id);
    if (issue) {
      usedMarkers.add(outcome.id);
      return { ...outcome, status: "EXPECTED_CHANGE", expected_change: issue };
    }
    return { ...outcome, status: "REGRESSION" };
  });
  for (const scenario of options.expectedChanges.keys()) {
    if (!usedMarkers.has(scenario)) throw new Error(`Unused --expect-change marker: ${scenario}`);
  }
  return compared;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const outputRoot = path.resolve(options.output);
  if (fs.existsSync(outputRoot) && fs.readdirSync(outputRoot).length > 0) {
    throw new Error(`Refusing to overwrite non-empty output directory: ${outputRoot}`);
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  const selected = options.scenarios.length === 0
    ? SCENARIOS
    : options.scenarios.map((id) => {
      const scenario = SCENARIOS.find((candidate) => candidate.id === id);
      if (!scenario) throw new Error(`Unknown scenario: ${id}`);
      return scenario;
    });
  const rawOutcomes = selected.map((scenario) => runScenario(scenario, options, outputRoot));
  const outcomes = applyComparison(rawOutcomes, options);
  const summary = {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    runner: "codex exec",
    model: options.model,
    reasoning: options.reasoning,
    compare: options.compare || null,
    guarantees: GUARANTEES,
    scenarios: outcomes.map((outcome) => ({ ...outcome, signature: outcomeSignature(outcome) })),
  };
  write(outputRoot, "summary.json", `${JSON.stringify(summary, null, 2)}\n`);
  for (const outcome of outcomes) {
    process.stdout.write(`${outcome.status} ${outcome.id}\n`);
  }
  if (outcomes.some((outcome) => ["FAIL", "REGRESSION"].includes(outcome.status))) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  SCENARIOS,
  GUARANTEES,
  snapshotTree,
  diffSnapshots,
  parseExpectedChange,
  parseArgs,
  gradeScenario,
  outcomeSignature,
};
