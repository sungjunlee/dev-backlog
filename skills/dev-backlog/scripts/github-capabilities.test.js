const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  closeMilestone,
  getMilestoneDue,
  getMilestoneIssues,
} = require("./github-milestones.js");
const {
  createMirrorIssue,
  findMirrorIssue,
  updateMirrorIssue,
} = require("./github-mirrors.js");
const { loadOpenIssues } = require("./sync-pull.js");
const { sync: syncMirror } = require("./sprint-mirror.js");
const { sync: syncProgress } = require("./progress-sync.js");
const { createSprintFile } = require("./sprint-init.js");
const { listStatusRows } = require("./tracker-status-list.js");
const { collectSnapshot } = require("../../backlog-triage/scripts/triage-collect.js");
const { execute: applyTriage } = require("../../backlog-triage/scripts/triage-apply.js");

function makeExec(responses) {
  const calls = [];
  return {
    calls,
    execFile(command, args, options) {
      calls.push({ command, args, options });
      return responses.shift() ?? "";
    },
  };
}

describe("GitHub optional capability transports", () => {
  it("preserves milestone lookup, list, and close argv", () => {
    const { calls, execFile } = makeExec([
      "2026-07-31T00:00:00Z\n",
      '[{"number":275,"title":"Adapter","labels":[]}]',
      "9\n",
      "",
    ]);

    assert.equal(getMilestoneDue("Batch 4", execFile), "2026-07-31");
    assert.deepEqual(getMilestoneIssues("Batch 4", execFile), [{
      number: 275,
      title: "Adapter",
      labels: [],
      tracker: "github",
      id: "275",
      ref: "#275",
    }]);
    assert.equal(closeMilestone("Batch 4", execFile), 1);

    assert.deepEqual(calls.map((call) => call.args), [
      ["api", "repos/{owner}/{repo}/milestones", "--jq", '.[] | select(.title==env.MS) | .due_on'],
      ["issue", "list", "--milestone", "Batch 4", "--state", "open", "--json", "number,title,labels"],
      ["api", "repos/{owner}/{repo}/milestones", "--jq", '.[] | select(.title==env.MS) | .number'],
      ["api", "-X", "PATCH", "repos/{owner}/{repo}/milestones/9", "-f", "state=closed"],
    ]);
    assert.equal(calls[0].options.env.MS, "Batch 4");
    assert.equal(calls[2].options.env.MS, "Batch 4");
  });

  it("preserves mirror find/create/update argv and legacy results", () => {
    const marker = "<!-- dev-backlog:sprint-mirror sprint=batch-4 -->";
    const { calls, execFile } = makeExec([
      JSON.stringify([{ number: 8, body: marker }]),
      "https://github.com/acme/widgets/issues/9\n",
      "",
    ]);

    assert.deepEqual(findMirrorIssue(marker, execFile), { number: 8, body: marker });
    assert.deepEqual(createMirrorIssue("Sprint mirror: batch-4", marker, execFile), { number: 9 });
    assert.equal(updateMirrorIssue(9, marker, execFile), undefined);
    assert.deepEqual(calls.map((call) => call.args), [
      ["issue", "list", "--state", "all", "--search", "dev-backlog:sprint-mirror in:body", "--json", "number,body", "--limit", "50"],
      ["issue", "create", "--title", "Sprint mirror: batch-4", "--body", marker],
      ["issue", "edit", "9", "--body", marker],
    ]);
  });

  it("preserves the human status list argv and row bytes through configured resolution", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "github-status-list-"));
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(backlogDir);
    const { calls, execFile } = makeExec([JSON.stringify([{
      number: 275,
      title: "GitHub adapter",
      labels: [{ name: "priority:high" }],
      milestone: { title: "Batch 4" },
    }])]);

    assert.deepEqual(listStatusRows(backlogDir, { execFile }), [
      "275\tBatch 4\tGitHub adapter\tpriority:high",
    ]);
    assert.deepEqual(calls[0].args, [
      "issue", "list", "--state", "open", "--limit", "20",
      "--json", "number,title,labels,milestone",
    ]);
  });
});

describe("configured-only failure before effects", () => {
  it("never executes GitHub or writes sprint state for explicit local", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "github-capability-gate-"));
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(backlogDir);
    fs.writeFileSync(path.join(backlogDir, "config.yml"), "tracker: local\n");
    let executions = 0;
    const execFile = () => {
      executions += 1;
      throw new Error("must not execute");
    };

    // Optional-capability GitHub flows stay fail-closed for explicit local:
    // they raise the tracker+capability error before any GitHub execution.
    assert.throws(() => syncMirror({ backlogDir, execFile }), /local/);
    assert.throws(() => syncProgress({ month: "2026-07", backlogDir, execFile }), /local/);
    assert.throws(() => createSprintFile({
      topic: "blocked",
      milestone: "blocked",
      dryRun: false,
      sprintsDir: path.join(backlogDir, "sprints"),
    }), /local/);
    await assert.rejects(
      collectSnapshot({ repo: "acme/widgets", trackerConfig: { tracker: "local" }, execFile }),
      /local/
    );

    // Required-op flows resolve the local adapter (post-#276) rather than
    // GitHub. They must never execute gh or fall back to the GitHub transport.
    loadOpenIssues({ config: { tracker: "local" }, execFile });

    const report = path.join(root, "report.md");
    fs.writeFileSync(report, [
      "---", "generated: 2026-07-11", "---", "",
      '<!-- triage:revisit issue=275 reason="check" -->',
      "- [x] revisit", "",
    ].join("\n"));
    const applied = applyTriage([report, "--apply", "--yes"], {
      cwd: root,
      trackerConfig: { tracker: "local" },
      runGh: () => {
        executions += 1;
        return { status: 0, stdout: "", stderr: "" };
      },
    });
    assert.equal(applied.exitCode, 0);
    assert.equal(executions, 0);
    assert.equal(fs.existsSync(path.join(backlogDir, "sprints")), false);
    assert.equal(fs.existsSync(path.join(backlogDir, "triage", "2026-07-11-apply.log")), false);
  });

  it("gates milestone close before doctor or sprint-file mutation", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "github-close-gate-"));
    const backlogDir = path.join(root, "backlog");
    const sprintsDir = path.join(backlogDir, "sprints");
    fs.mkdirSync(sprintsDir, { recursive: true });
    fs.writeFileSync(path.join(backlogDir, "config.yml"), "tracker: local\n");
    const sprintPath = path.join(sprintsDir, "active.md");
    fs.writeFileSync(sprintPath, [
      "---", "milestone: Batch 4", "status: active", "---", "",
      "## Plan", "- [x] #275 Adapter", "", "## Running Context", "", "## Progress", "",
    ].join("\n"));

    const result = spawnSync("bash", [
      path.join(__dirname, "sprint-close.sh"),
      backlogDir,
      "--close-milestone",
    ], { encoding: "utf8" });

    assert.equal(result.status, 1);
    assert.match(`${result.stdout}${result.stderr}`, /local/);
    assert.match(fs.readFileSync(sprintPath, "utf8"), /^status: active$/m);
    assert.doesNotMatch(fs.readFileSync(sprintPath, "utf8"), /Sprint closed/);
  });

  it("refuses to overwrite an exact-title progress issue without the owned marker", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "github-progress-marker-"));
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(backlogDir);
    let searches = 0;
    const calls = [];
    const execFile = (_command, args) => {
      calls.push(args);
      if (args[0] === "pr") return "[]";
      if (args[0] === "issue" && args[1] === "list") {
        searches += 1;
        return searches === 1
          ? JSON.stringify([{ number: 88, title: "Progress: July 2026", body: "Human notes" }])
          : "[]";
      }
      throw new Error(`unexpected mutation: ${args.join(" ")}`);
    };

    assert.throws(
      () => syncProgress({ month: "2026-07", backlogDir, execFile }),
      /missing managed progress marker/
    );
    assert.equal(calls.some((args) => ["create", "edit", "comment"].includes(args[1])), false);
  });
});
