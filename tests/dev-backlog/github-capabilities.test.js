const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const TRIAGE_SCRIPTS = path.resolve(__dirname, "../../skills/backlog-triage/scripts");
const { spawnBashSync } = require(path.join(SKILL_SCRIPTS, "bash-runtime.js"));

const {
  closeMilestone,
  getMilestoneDue,
  getMilestoneIssues,
} = require(path.join(SKILL_SCRIPTS, "github-milestones.js"));
const { listStatusRows } = require(path.join(SKILL_SCRIPTS, "tracker-status-list.js"));
const { createSprintFile } = require(path.join(SKILL_SCRIPTS, "sprint-init.js"));
const { collectSnapshot } = require(path.join(TRIAGE_SCRIPTS, "triage-collect.js"));
const { execute: applyTriage } = require(path.join(TRIAGE_SCRIPTS, "triage-apply.js"));

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
      "9\topen\n",
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
      ["api", "--paginate", "repos/{owner}/{repo}/milestones?state=all&per_page=100", "--jq", '.[] | select(.title==env.MS) | [.number, .state] | @tsv'],
      ["api", "-X", "PATCH", "repos/{owner}/{repo}/milestones/9", "-f", "state=closed"],
    ]);
    assert.equal(calls[0].options.env.MS, "Batch 4");
    assert.equal(calls[2].options.env.MS, "Batch 4");
  });

  it("preserves human status-list argv and row bytes through configured resolution", () => {
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

describe("retired tracker public mutation boundaries", () => {
  it("rejects local config before sprint-init or triage provider/filesystem effects", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "retired-tracker-mutations-"));
    const backlogDir = path.join(root, "backlog");
    fs.mkdirSync(backlogDir);
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "local\n");
    let providerCalls = 0;
    const provider = () => {
      providerCalls += 1;
      throw new Error("provider must not execute");
    };

    assert.throws(() => createSprintFile({
      topic: "blocked",
      milestone: "blocked",
      sprintsDir: path.join(backlogDir, "sprints"),
    }), /expected one of: github/);

    await assert.rejects(
      collectSnapshot({
        repo: "acme/widgets",
        trackerConfig: { tracker: "local" },
        execFile: provider,
      }),
      /expected one of: github/
    );

    const report = path.join(root, "report.md");
    fs.writeFileSync(report, [
      "---", "generated: 2026-07-31", "---", "",
      '<!-- triage:revisit issue=275 reason="check" -->',
      "- [x] revisit", "",
    ].join("\n"));
    const applied = applyTriage([report, "--apply", "--yes"], {
      cwd: root,
      trackerConfig: { tracker: "local" },
      runGh: provider,
    });
    assert.equal(applied.exitCode, 1);
    assert.match(applied.error, /expected one of: github/);
    assert.equal(providerCalls, 0);
    assert.equal(fs.existsSync(path.join(backlogDir, "sprints")), false);
    assert.equal(fs.existsSync(path.join(backlogDir, "triage")), false);
  });

  it("rejects local selection before milestone close or sprint mutation", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "retired-tracker-close-"));
    const backlogDir = path.join(root, "backlog");
    const sprintsDir = path.join(backlogDir, "sprints");
    fs.mkdirSync(sprintsDir, { recursive: true });
    fs.writeFileSync(path.join(backlogDir, ".tracker"), "local\n");
    const sprintPath = path.join(sprintsDir, "active.md");
    fs.writeFileSync(sprintPath, [
      "---", "milestone: Batch 4", "status: active", "---", "",
      "## Plan", "- [x] #275 Adapter", "",
      "## Running Context", "", "## Progress", "",
    ].join("\n"));
    const before = fs.readFileSync(sprintPath, "utf8");

    const result = spawnBashSync([
      path.join(SKILL_SCRIPTS, "sprint-close.sh"),
      backlogDir,
      "--close-milestone",
    ], { cwd: root, encoding: "utf8" });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /expected one of: github/);
    assert.equal(fs.readFileSync(sprintPath, "utf8"), before);
  });
});
