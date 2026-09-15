/**
 * Fake `glab` executable script used by GitLab tracker tests.
 *
 * Written to a temp bin/ directory by fake-glab-fixture.js and invoked through
 * node. Records every argv line to FAKE_GLAB_LOG (jsonl) and keeps issue state
 * in FAKE_GLAB_STATE (json). State is only ever written after a successful
 * simulated call — a failing call appends to the log but never mutates state.
 *
 * Failure injection (set FAKE_GLAB_FAIL in the environment):
 *   auth-expired    every call exits 1, stderr "HTTP 401" + "authentication required"
 *   http-502        every call exits 1, stderr "HTTP 502 Bad Gateway"
 *   probe-error     every call exits 1, stderr "glab unavailable"
 */

const GLAB_SCRIPT = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const statePath = process.env.FAKE_GLAB_STATE;
const logPath = process.env.FAKE_GLAB_LOG;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
fs.appendFileSync(logPath, JSON.stringify(args) + "\\n");

const failMode = process.env.FAKE_GLAB_FAIL || "";
if (failMode === "http-502") {
  process.stderr.write("glab: HTTP 502 Bad Gateway\\n");
  process.exit(1);
}
if (failMode === "auth-expired") {
  process.stderr.write("glab: HTTP 401: authentication required (Bad credentials)\\n");
  process.exit(1);
}
if (failMode === "probe-error") {
  process.stderr.write("glab unavailable\\n");
  process.exit(1);
}

const save = () => fs.writeFileSync(statePath, JSON.stringify(state));
const out = (value) => process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
const has = (flag) => args.includes(flag);
const valuesAfter = (flag) => {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag && args[i + 1] !== undefined) {
      values.push(args[i + 1]);
      i += 1;
    }
  }
  return values;
};
const valueAfter = (flag) => {
  const values = valuesAfter(flag);
  return values.length ? values[values.length - 1] : undefined;
};
const firstPositional = (start) => {
  for (let i = start; i < args.length; i += 1) {
    if (!String(args[i]).startsWith("-")) return args[i];
  }
  return undefined;
};
const findIssue = (raw) => {
  const iid = String(raw).replace(/^gitlab#/i, "");
  return state.issues.find((issue) => String(issue.iid) === iid);
};
const compact = (issue) => ({
  id: issue.id,
  iid: issue.iid,
  title: issue.title,
  description: issue.description || "",
  state: issue.state,
  labels: issue.labels || [],
  milestone: issue.milestone || null,
  assignees: issue.assignees || [],
  web_url: issue.web_url,
  created_at: issue.created_at || null,
  updated_at: issue.updated_at || null,
});
const full = (issue) => ({
  ...compact(issue),
  notes: issue.notes || [],
});

if (args[0] === "version") {
  out("glab 1.53.0\\n");
  process.exit(0);
}

if (args[0] === "auth" && args[1] === "status") {
  if (state.authenticated === false) {
    process.stderr.write("glab: x No token found for gitlab.test\\n");
    process.exit(1);
  }
  out("gitlab.test\\n  ✓ Logged in to gitlab.test as test-user\\n");
  process.exit(0);
}

if (args[0] !== "issue") {
  process.stderr.write("unhandled fake glab argv: " + JSON.stringify(args) + "\\n");
  process.exit(93);
}

if (args[1] === "list") {
  if (!has("--output") || valueAfter("--output") !== "json") {
    process.stderr.write("unhandled fake glab argv: " + JSON.stringify(args) + "\\n");
    process.exit(93);
  }
  let issues = state.issues.slice();
  if (has("--closed")) issues = issues.filter((issue) => issue.state === "closed");
  else if (!has("--all")) issues = issues.filter((issue) => issue.state === "opened");
  const perPage = valueAfter("--per-page");
  if (perPage) issues = issues.slice(0, Number(perPage));
  out(issues.map(compact));
  process.exit(0);
}

if (args[1] === "view") {
  if (!has("--output") || valueAfter("--output") !== "json") {
    process.stderr.write("unhandled fake glab argv: " + JSON.stringify(args) + "\\n");
    process.exit(93);
  }
  const iid = firstPositional(2);
  const issue = findIssue(iid);
  if (!issue) process.exit(4);
  out(has("--comments") ? full(issue) : compact(issue));
  process.exit(0);
}

if (args[1] === "create") {
  const title = valueAfter("--title");
  if (!title) {
    process.stderr.write("fake glab: create requires --title\\n");
    process.exit(1);
  }
  const iid = state.nextIid++;
  const issue = {
    id: 10000 + iid,
    iid,
    title,
    description: valueAfter("--description") || "",
    state: "opened",
    labels: [],
    assignees: [],
    notes: [],
    web_url: "https://gitlab.test/acme/widgets/-/issues/" + iid,
    created_at: "2026-09-15T00:00:00Z",
    updated_at: "2026-09-15T00:00:00Z",
  };
  state.issues.push(issue);
  save();
  out(issue.web_url + "\\n");
  process.exit(0);
}

if (args[1] === "update") {
  const issue = findIssue(firstPositional(2));
  if (!issue) process.exit(4);
  const title = valueAfter("--title");
  if (title !== undefined) issue.title = title;
  const description = valueAfter("--description");
  if (description !== undefined) issue.description = description;
  for (const label of valuesAfter("--label")) {
    issue.labels = issue.labels || [];
    if (!issue.labels.includes(label)) issue.labels.push(label);
  }
  const unlabeled = new Set(valuesAfter("--unlabel"));
  if (unlabeled.size) {
    issue.labels = (issue.labels || []).filter((label) => !unlabeled.has(label));
  }
  issue.updated_at = "2026-09-15T00:00:00Z";
  save();
  process.exit(0);
}

if (args[1] === "close") {
  const issue = findIssue(firstPositional(2));
  if (!issue) process.exit(4);
  issue.state = "closed";
  issue.updated_at = "2026-09-15T00:00:00Z";
  save();
  process.exit(0);
}

if (args[1] === "note" || args[1] === "comment") {
  const issue = findIssue(firstPositional(2));
  if (!issue) process.exit(4);
  const message = valueAfter("--message") || valueAfter("-m");
  if (message === undefined) {
    process.stderr.write("fake glab: note requires --message\\n");
    process.exit(1);
  }
  issue.notes = issue.notes || [];
  issue.notes.push({
    id: issue.notes.length + 1,
    body: message,
    created_at: "2026-09-15T00:00:00Z",
  });
  issue.updated_at = "2026-09-15T00:00:00Z";
  save();
  process.exit(0);
}

process.stderr.write("unhandled fake glab argv: " + JSON.stringify(args) + "\\n");
process.exit(93);
`;

module.exports = { GLAB_SCRIPT };
