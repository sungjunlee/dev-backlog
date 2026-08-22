#!/usr/bin/env node
const fs = require("node:fs");

const args = process.argv.slice(2);
const statePath = process.env.FAKE_GH_STATE;
const logPath = process.env.FAKE_GH_LOG;
const failMode = process.env.FAKE_GH_FAIL || "";
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
fs.appendFileSync(logPath, JSON.stringify(args) + "\n");

const save = () => fs.writeFileSync(statePath, JSON.stringify(state));
const valueAfter = (flag) => args[args.indexOf(flag) + 1];
const out = (value) => process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
const exact = (expected) => JSON.stringify(args) === JSON.stringify(expected);
const exactBodyCall = (head) =>
  args.length === head.length + 2 &&
  exact([...head, "--body", args[args.length - 1]]) &&
  typeof args[args.length - 1] === "string";

function isMutation(argv) {
  if (argv[0] === "issue" && ["create", "edit", "close", "comment"].includes(argv[1])) {
    return true;
  }
  return argv[0] === "api" && argv.includes("-X");
}

if (failMode === "rate-limit") {
  process.stderr.write("API rate limit exceeded\n");
  process.exit(1);
}
if (failMode === "auth-expired") {
  process.stderr.write("HTTP 401: authentication required. Run gh auth login.\n");
  process.exit(1);
}
if (failMode === "partial-outage" && isMutation(args)) {
  process.stderr.write("GitHub unavailable\n");
  process.exit(1);
}

if (exactBodyCall(["issue", "create", "--title", args[3]]) && args[3]) {
  const title = valueAfter("--title");
  const body = valueAfter("--body") || "";
  const number = state.nextIssue++;
  state.issues.push({
    number, title, body, state: "open", url: "https://github.test/acme/widgets/issues/" + number,
    labels: [{ name: "priority:high" }], milestone: { title: "Cycle Milestone" }, assignees: [],
  });
  save(); out("https://github.test/acme/widgets/issues/" + number + "\n");
  process.exit(0);
}

if (args[0] === "issue" && args[1] === "list") {
  if (exact(["issue", "list", "--milestone", "Cycle Milestone", "--state", "open", "--json", "number,title,labels"])) {
    out(state.issues.filter((issue) => issue.state === "open").map(({ number, title, labels }) => ({ number, title, labels })));
  } else if (exact(["issue", "list", "--state", "open", "--limit", "1", "--json", "number,title,body,labels,milestone,assignees"]) ||
      exact(["issue", "list", "--state", "closed", "--limit", "20", "--json", "number,title,body,labels,milestone,assignees,createdAt,updatedAt"])) {
    out(state.issues.filter((issue) => {
      const requested = valueAfter("--state") || "open";
      return requested === "all" || issue.state === requested;
    }));
  } else {
    process.stderr.write("unhandled fake gh argv: " + JSON.stringify(args) + "\n"); process.exit(93);
  }
  process.exit(0);
}

if (exact(["issue", "view", "42", "--json", "number,title,body,labels,milestone,assignees,createdAt,updatedAt"]) ||
    exact(["issue", "view", "42", "--json", "number,title,body,state,labels,milestone,assignees,createdAt,updatedAt,url"]) ||
    exact(["issue", "view", "42", "--json", "number,title,body,state,labels,milestone,assignees,createdAt,updatedAt,url,comments"])) {
  const issue = state.issues.find((candidate) => String(candidate.number) === args[2]);
  if (!issue) process.exit(4);
  out(issue); process.exit(0);
}

if (exact(["issue", "edit", "42", "--title", "Cycle task renamed"])) {
  const number = Number(args[2]);
  const issue = state.issues.find((candidate) => candidate.number === number);
  if (issue) issue.title = valueAfter("--title");
  save(); process.exit(0);
}

if (exact(["issue", "close", "42"])) {
  const issue = state.issues.find((candidate) => String(candidate.number) === args[2]);
  if (issue) issue.state = "closed";
  save(); process.exit(0);
}

if (exact(["api", "repos/{owner}/{repo}/milestones", "--jq", ".[] | select(.title==env.MS) | .due_on"]) ||
    exact(["api", "repos/{owner}/{repo}/milestones", "--jq", ".[] | select(.title==env.MS) | .number"])) {
  const query = valueAfter("--jq");
  out(query.includes("due_on") ? "2026-06-30T00:00:00Z\n" : "7\n");
  process.exit(0);
}
if (exact(["api", "-X", "PATCH", "repos/{owner}/{repo}/milestones/7", "-f", "state=closed"])) {
  state.milestoneClosed = true; save(); process.exit(0);
}
process.stderr.write("unhandled fake gh argv: " + JSON.stringify(args) + "\n");
process.exit(93);
