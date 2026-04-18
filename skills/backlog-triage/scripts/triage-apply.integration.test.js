const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("node:child_process");

const SANDBOX_REPO = "sungjunlee/triage-apply-sandbox";
const SANDBOX_MILESTONE = "Sandbox Sprint";
const APPLY_SCRIPT_PATH = path.join(__dirname, "triage-apply.js");
const INTEGRATION_SKIP_REASON =
  process.env.TRIAGE_APPLY_INTEGRATION === "1"
    ? (process.env.GH_TOKEN ? null : "requires GH_TOKEN with write access to the sandbox repo")
    : "set TRIAGE_APPLY_INTEGRATION=1 to run live triage-apply integration coverage";

const BASELINE_ISSUES = {
  "Sandbox canonical target": {
    state: "OPEN",
    labels: ["priority:medium", "type:feature"],
    milestone: null,
  },
  "Sandbox close target": {
    state: "OPEN",
    labels: ["priority:medium", "type:bug"],
    milestone: null,
  },
  "Sandbox revisit target": {
    state: "OPEN",
    labels: ["priority:low", "type:feature"],
    milestone: null,
  },
  "Sandbox duplicate source": {
    state: "OPEN",
    labels: ["priority:medium", "type:bug"],
    milestone: null,
  },
  "Sandbox priority target": {
    state: "OPEN",
    labels: ["priority:low", "type:feature"],
    milestone: null,
  },
  "Sandbox milestone target": {
    state: "OPEN",
    labels: ["type:feature"],
    milestone: null,
  },
  "Sandbox baseline milestone holder": {
    state: "OPEN",
    labels: ["priority:medium", "type:feature"],
    milestone: SANDBOX_MILESTONE,
  },
};

function gh(args, { cwd, repoScoped = false } = {}) {
  const commandArgs = repoScoped ? [...args, "--repo", SANDBOX_REPO] : args;
  return execFileSync("gh", commandArgs, {
    cwd,
    encoding: "utf-8",
    env: process.env,
  });
}

function cloneSandbox(tempDir) {
  const clonePath = path.join(tempDir, "triage-apply-sandbox");
  gh(["repo", "clone", SANDBOX_REPO, clonePath, "--", "--quiet"]);
  return clonePath;
}

function listSandboxIssues(cwd) {
  return JSON.parse(
    gh(
      [
        "issue",
        "list",
        "--state",
        "all",
        "--limit",
        "50",
        "--json",
        "number,title,state,labels,milestone",
      ],
      { cwd, repoScoped: true }
    )
  );
}

function mapIssuesByTitle(issues) {
  return new Map(issues.map((issue) => [issue.title, issue]));
}

function sortedLabels(labels) {
  return [...labels].sort();
}

function syncIssueLabels(cwd, issueNumber, targetLabels) {
  const current = JSON.parse(
    gh(["issue", "view", String(issueNumber), "--json", "labels"], { cwd, repoScoped: true })
  ).labels.map((label) => label.name);

  const toAdd = targetLabels.filter((label) => !current.includes(label));
  const toRemove = current.filter((label) => !targetLabels.includes(label));
  if (toAdd.length === 0 && toRemove.length === 0) return;

  const args = ["issue", "edit", String(issueNumber)];
  for (const label of toAdd) args.push("--add-label", label);
  for (const label of toRemove) args.push("--remove-label", label);
  gh(args, { cwd, repoScoped: true });
}

function syncIssueState(cwd, issueNumber, targetState) {
  const view = JSON.parse(
    gh(["issue", "view", String(issueNumber), "--json", "state"], { cwd, repoScoped: true })
  );

  if (view.state === targetState) return;
  if (targetState === "OPEN") {
    gh(["issue", "reopen", String(issueNumber)], { cwd, repoScoped: true });
    return;
  }
  gh(["issue", "close", String(issueNumber), "--reason", "not planned"], { cwd, repoScoped: true });
}

function syncIssueMilestone(cwd, issueNumber, milestoneTitle) {
  const current = JSON.parse(
    gh(["issue", "view", String(issueNumber), "--json", "milestone"], { cwd, repoScoped: true })
  ).milestone;

  const currentTitle = current?.title || null;
  if (currentTitle === milestoneTitle) return;

  if (milestoneTitle) {
    gh(["issue", "edit", String(issueNumber), "--milestone", milestoneTitle], { cwd, repoScoped: true });
    return;
  }

  gh(["issue", "edit", String(issueNumber), "--remove-milestone"], { cwd, repoScoped: true });
}

function applyBaseline(cwd, issuesByTitle) {
  for (const [title, baseline] of Object.entries(BASELINE_ISSUES)) {
    const issue = issuesByTitle.get(title);
    if (!issue) {
      throw new Error(`Missing sandbox baseline issue: ${title}`);
    }

    syncIssueState(cwd, issue.number, baseline.state);
    syncIssueLabels(cwd, issue.number, baseline.labels);
    syncIssueMilestone(cwd, issue.number, baseline.milestone);
  }
}

function buildReport(issueNumbers, runId) {
  return [
    "---",
    "generated: 2026-04-18",
    `repo: ${SANDBOX_REPO}`,
    "snapshot: backlog/triage/.cache/2026-04-18T10-00-00Z.json",
    "open_issues: 7",
    "---",
    "",
    "# Backlog Triage - Integration",
    "",
    "## Obsolete Candidates",
    `<!-- triage:close #${issueNumbers.close} reason=\"integration close ${runId}\" -->`,
    `- [x] Close #${issueNumbers.close} - integration close ${runId}`,
    "",
    `<!-- triage:close-duplicate #${issueNumbers.duplicateSource} target=#${issueNumbers.canonical} reason=\"integration duplicate ${runId}\" -->`,
    `- [x] Close duplicate #${issueNumbers.duplicateSource} into #${issueNumbers.canonical}`,
    "",
    "## Priority Proposals",
    `<!-- triage:set-priority #${issueNumbers.priority} value=high reason=\"integration priority ${runId}\" -->`,
    `- [x] Set priority:high on #${issueNumbers.priority}`,
    "",
    "## Milestone Suggestions",
    `<!-- triage:assign-milestone #${issueNumbers.milestone} name=\"${SANDBOX_MILESTONE}\" cluster=sandbox -->`,
    `- [x] Assign ${SANDBOX_MILESTONE} to #${issueNumbers.milestone}`,
    "",
    "## Apply Checklist",
    `<!-- triage:revisit #${issueNumbers.revisit} reason=\"integration revisit ${runId}\" -->`,
    `- [x] Revisit #${issueNumbers.revisit}`,
    "",
  ].join("\n");
}

function readIssue(cwd, issueNumber) {
  return JSON.parse(
    gh(
      [
        "issue",
        "view",
        String(issueNumber),
        "--json",
        "state,stateReason,labels,milestone,comments",
      ],
      { cwd, repoScoped: true }
    )
  );
}

function hasCommentContaining(issue, text) {
  return issue.comments.some((comment) => comment.body.includes(text));
}

describe("triage-apply integration", () => {
  let tempDir;
  let sandboxClone;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-apply-integration-"));
    sandboxClone = cloneSandbox(tempDir);
  });

  afterEach(() => {
    if (sandboxClone && fs.existsSync(sandboxClone)) {
      const issuesByTitle = mapIssuesByTitle(listSandboxIssues(sandboxClone));
      applyBaseline(sandboxClone, issuesByTitle);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it(
    "runs triage-apply --apply --yes against the disposable sandbox repo",
    { skip: INTEGRATION_SKIP_REASON || false, timeout: 120000 },
    () => {
      const issuesByTitle = mapIssuesByTitle(listSandboxIssues(sandboxClone));
      applyBaseline(sandboxClone, issuesByTitle);

      const issueNumbers = {
        canonical: issuesByTitle.get("Sandbox canonical target").number,
        close: issuesByTitle.get("Sandbox close target").number,
        revisit: issuesByTitle.get("Sandbox revisit target").number,
        duplicateSource: issuesByTitle.get("Sandbox duplicate source").number,
        priority: issuesByTitle.get("Sandbox priority target").number,
        milestone: issuesByTitle.get("Sandbox milestone target").number,
      };

      const runId = `integration-${Date.now()}`;
      const reportPath = path.join(sandboxClone, "backlog", "triage", "integration-report.md");
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, `${buildReport(issueNumbers, runId)}\n`);

      const stdout = execFileSync(
        process.execPath,
        [APPLY_SCRIPT_PATH, reportPath, "--apply", "--yes", "--json"],
        {
          cwd: sandboxClone,
          encoding: "utf-8",
          env: process.env,
        }
      );

      const parsed = JSON.parse(stdout);
      assert.equal(parsed.apply_mode, "apply");
      assert.equal(parsed.actions.length, 5);
      assert.equal(parsed.skipped.length, 0);

      const closedIssue = readIssue(sandboxClone, issueNumbers.close);
      assert.equal(closedIssue.state, "CLOSED");
      assert.ok(hasCommentContaining(closedIssue, `integration close ${runId}`));

      const revisitIssue = readIssue(sandboxClone, issueNumbers.revisit);
      assert.equal(revisitIssue.state, "OPEN");
      assert.ok(hasCommentContaining(revisitIssue, `triage: revisit — integration revisit ${runId}`));

      const duplicateIssue = readIssue(sandboxClone, issueNumbers.duplicateSource);
      assert.equal(duplicateIssue.state, "CLOSED");
      assert.equal(duplicateIssue.stateReason, "NOT_PLANNED");
      assert.ok(hasCommentContaining(duplicateIssue, `Duplicate of #${issueNumbers.canonical}. integration duplicate ${runId}`));

      const priorityIssue = readIssue(sandboxClone, issueNumbers.priority);
      assert.deepEqual(
        sortedLabels(priorityIssue.labels.map((label) => label.name)),
        sortedLabels(["priority:high", "type:feature"])
      );

      const milestoneIssue = readIssue(sandboxClone, issueNumbers.milestone);
      assert.equal(milestoneIssue.milestone?.title || null, SANDBOX_MILESTONE);

      const logPath = path.join(sandboxClone, "backlog", "triage", "2026-04-18-apply.log");
      assert.equal(fs.existsSync(logPath), true);
    }
  );
});
