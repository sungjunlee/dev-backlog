/** GitHub implementation of the required seven-operation tracker lifecycle. */

const { execFileSync } = require("child_process");

const GH_EXEC_DEFAULTS = {
  encoding: "utf-8",
  maxBuffer: 50 * 1024 * 1024,
};
const OPEN_ISSUE_COUNT_QUERY =
  "query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { issues(states: OPEN) { totalCount } } }";
const OPEN_ISSUE_JSON_FIELDS =
  "number,title,body,labels,milestone,assignees,createdAt,updatedAt";

function buildIssueCountArgs(repo) {
  if (!repo) {
    return [
      "api", "graphql", "-F", "owner={owner}", "-F", "name={repo}",
      "-f", `query=${OPEN_ISSUE_COUNT_QUERY}`,
      "--jq", ".data.repository.issues.totalCount",
    ];
  }
  const [owner, name] = repo.split("/");
  if (!owner || !name) {
    throw new Error(`Invalid repo value: ${repo}. Expected OWNER/REPO.`);
  }
  return [
    "api", "graphql", "-F", `owner=${owner}`, "-F", `name=${name}`,
    "-f", `query=${OPEN_ISSUE_COUNT_QUERY}`,
    "--jq", ".data.repository.issues.totalCount",
  ];
}

function getOpenIssueCount({ repo, execFile = execFileSync } = {}) {
  const output = execFile("gh", buildIssueCountArgs(repo), GH_EXEC_DEFAULTS).trim();
  const count = Number.parseInt(output, 10);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Invalid issue count from gh: ${output}`);
  }
  return count;
}

function githubIdentity(number, url) {
  const id = String(number);
  if (!/^\d+$/.test(id) || Number(id) < 1) {
    throw new Error(`Invalid GitHub issue number: ${number}`);
  }
  const identity = { tracker: "github", id, ref: `#${id}` };
  if (url !== undefined && url !== null && url !== "") {
    let parsed;
    try {
      parsed = new URL(String(url));
    } catch {
      throw new Error(`Invalid GitHub issue URL: ${url}`);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Invalid GitHub issue URL: ${url}`);
    }
    identity.url = String(url);
  }
  return identity;
}

function normalizeGithubTask(issue) {
  if (issue === null || typeof issue !== "object" || Array.isArray(issue)) {
    throw new Error("Invalid GitHub issue result: expected an object.");
  }
  return { ...issue, ...githubIdentity(issue.number, issue.url) };
}

function identityFrom(value) {
  if (typeof value === "number" || (typeof value === "string" && /^#?\d+$/.test(value))) {
    return githubIdentity(String(value).replace(/^#/, ""));
  }
  if (value === null || typeof value !== "object" || value.tracker !== "github") {
    throw new Error("GitHub lifecycle operation requires a GitHub task identity.");
  }
  const identity = githubIdentity(value.id, value.url);
  if (value.ref !== identity.ref) throw new Error(`Invalid GitHub task ref: ${value.ref}`);
  return identity;
}

function parseCreatedIssue(output) {
  const url = String(output).trim();
  const match = url.match(/\/issues\/(\d+)\s*$/);
  if (!match) throw new Error(`Failed to parse issue number from gh output: ${url}`);
  return githubIdentity(match[1], url);
}

function createGithubAdapter({ execFile = execFileSync, listTransport } = {}) {
  return Object.freeze({
    availability: () => ({ available: true }),
    capabilities: () => [
      "milestones",
      "pull-request-relationships",
      "mirrors",
      "progress-issues",
      "comments",
      "closing-semantics",
    ],
    list({ state = "open", limit, defaultLimit, repo, fields = OPEN_ISSUE_JSON_FIELDS } = {}) {
      if (listTransport) {
        const transported = listTransport({ state, limit, defaultLimit, repo, fields });
        if (!Array.isArray(transported)) {
          throw new Error("Invalid GitHub issue list result: expected an array.");
        }
        return transported.map(normalizeGithubTask);
      }
      const resolvedLimit = limit ?? defaultLimit ?? getOpenIssueCount({ repo, execFile });
      if (resolvedLimit === 0) return [];
      const args = ["issue", "list", "--state", state, "--limit", String(resolvedLimit)];
      if (repo) args.push("--repo", repo);
      args.push("--json", fields);
      const issues = JSON.parse(execFile("gh", args, GH_EXEC_DEFAULTS));
      if (!Array.isArray(issues)) throw new Error("Invalid GitHub issue list result: expected an array.");
      return issues.map(normalizeGithubTask);
    },
    read(taskIdentity, { repo, fields = OPEN_ISSUE_JSON_FIELDS } = {}) {
      const identity = identityFrom(taskIdentity);
      const args = ["issue", "view", identity.id];
      if (repo) args.push("--repo", repo);
      args.push("--json", fields);
      const issue = JSON.parse(execFile("gh", args, GH_EXEC_DEFAULTS));
      return normalizeGithubTask({ ...issue, number: issue.number ?? Number(identity.id) });
    },
    create({ title, body, repo } = {}) {
      if (typeof title !== "string" || !title.trim()) {
        throw new Error("GitHub task creation requires a non-empty title.");
      }
      const args = ["issue", "create", "--title", title];
      if (body !== undefined) args.push("--body", String(body));
      if (repo) args.push("--repo", repo);
      return parseCreatedIssue(execFile("gh", args, GH_EXEC_DEFAULTS));
    },
    update(taskIdentity, changes = {}) {
      const identity = identityFrom(taskIdentity);
      const args = ["issue", "edit", identity.id];
      if (changes.title !== undefined) args.push("--title", String(changes.title));
      if (changes.body !== undefined) args.push("--body", String(changes.body));
      for (const label of changes.addLabels || []) args.push("--add-label", String(label));
      for (const label of changes.removeLabels || []) args.push("--remove-label", String(label));
      if (changes.milestone !== undefined) args.push("--milestone", String(changes.milestone));
      if (changes.repo) args.push("--repo", changes.repo);
      if (args.length > 3) execFile("gh", args, GH_EXEC_DEFAULTS);
      return identity;
    },
    close(taskIdentity, { repo, reason } = {}) {
      const identity = identityFrom(taskIdentity);
      const args = ["issue", "close", identity.id];
      if (reason) args.push("-r", String(reason));
      if (repo) args.push("--repo", repo);
      execFile("gh", args, GH_EXEC_DEFAULTS);
      return identity;
    },
  });
}

function stripNormalizedIdentity(task) {
  const { tracker: _tracker, id: _id, ref: _ref, ...legacy } = task;
  return legacy;
}

module.exports = {
  GH_EXEC_DEFAULTS,
  OPEN_ISSUE_COUNT_QUERY,
  OPEN_ISSUE_JSON_FIELDS,
  buildIssueCountArgs,
  createGithubAdapter,
  getOpenIssueCount,
  githubIdentity,
  normalizeGithubTask,
  stripNormalizedIdentity,
};
