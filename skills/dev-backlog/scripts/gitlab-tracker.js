/**
 * GitLab implementation of the required seven-operation tracker lifecycle.
 * Thin glab CLI translation. Port contract: references/adapter-ports.md.
 *
 * Identities: tracker "gitlab", id = issue IID, ref = gitlab#N (disambiguates
 * from GitHub #N). Forgejo/Gitea share forge field shapes and are follow-ups.
 */

const { execFileSync } = require("child_process");

const GLAB_BIN = "glab";
const GLAB_EXEC_DEFAULTS = {
  encoding: "utf-8",
  maxBuffer: 50 * 1024 * 1024,
};
const GITLAB_ID_RE = /^[1-9]\d*$/;
const GITLAB_ISSUE_URL_RE = /\/(?:-\/)?issues\/(\d+)\s*$/;

function gitlabIdentity(iid, url) {
  const id = String(iid ?? "").replace(/^gitlab#/i, "");
  if (!GITLAB_ID_RE.test(id)) {
    throw new Error(`Invalid GitLab issue IID: ${iid}`);
  }
  const identity = { tracker: "gitlab", id, ref: `gitlab#${id}` };
  if (url !== undefined && url !== null && url !== "") {
    let parsed;
    try {
      parsed = new URL(String(url));
    } catch {
      throw new Error(`Invalid GitLab issue URL: ${url}`);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Invalid GitLab issue URL: ${url}`);
    }
    identity.url = String(url);
  }
  return identity;
}

function issueIid(issue) {
  if (issue === null || typeof issue !== "object" || Array.isArray(issue)) {
    return undefined;
  }
  if (issue.iid !== undefined && issue.iid !== null && issue.iid !== "") {
    return issue.iid;
  }
  if (issue.Iid !== undefined && issue.Iid !== null && issue.Iid !== "") {
    return issue.Iid;
  }
  return issue.number;
}

function issueUrl(issue) {
  return issue.web_url || issue.webUrl || issue.WebURL || issue.url;
}

function issueNotes(issue) {
  const raw = issue.notes || issue.Notes || issue.comments || issue.Comments;
  if (!Array.isArray(raw)) return [];
  return raw.map((note) => {
    if (note === null || typeof note !== "object") return { body: String(note ?? "") };
    const body = note.body ?? note.note ?? note.content ?? "";
    const mapped = { ...note, body: String(body) };
    if (note.url || note.web_url) mapped.url = String(note.url || note.web_url);
    return mapped;
  });
}

function normalizeGitlabState(state) {
  const value = String(state ?? "").trim().toLowerCase();
  if (value === "opened" || value === "open") return "open";
  if (value === "closed" || value === "close") return "closed";
  return state;
}

function normalizeGitlabTask(issue) {
  if (issue === null || typeof issue !== "object" || Array.isArray(issue)) {
    throw new Error("Invalid GitLab issue result: expected an object.");
  }
  const iid = issueIid(issue);
  const identity = gitlabIdentity(iid, issueUrl(issue));
  const description = issue.description ?? issue.body ?? "";
  const body = issue.body ?? issue.description ?? "";
  const comments = issueNotes(issue);
  const labels = Array.isArray(issue.labels) ? issue.labels : [];
  const task = {
    ...issue,
    ...identity,
    number: Number(identity.id),
    iid: Number(identity.id),
    title: issue.title,
    description,
    body,
    state: normalizeGitlabState(issue.state) ?? issue.state,
    labels,
    comments,
    milestone: issue.milestone ?? null,
    assignees: issue.assignees ?? [],
    createdAt: issue.createdAt ?? issue.created_at,
    updatedAt: issue.updatedAt ?? issue.updated_at,
  };
  if (!identity.url) delete task.url;
  return task;
}

function identityFrom(value) {
  if (typeof value === "number" || (typeof value === "string" && /^(?:gitlab#)?[1-9]\d*$/i.test(value))) {
    return gitlabIdentity(String(value).replace(/^gitlab#/i, ""));
  }
  if (value === null || typeof value !== "object" || value.tracker !== "gitlab") {
    throw new Error("GitLab lifecycle operation requires a GitLab task identity.");
  }
  const identity = gitlabIdentity(value.id, value.url);
  if (value.ref !== identity.ref) throw new Error(`Invalid GitLab task ref: ${value.ref}`);
  return identity;
}

function parseJson(output, label) {
  let parsed;
  try {
    parsed = JSON.parse(String(output));
  } catch (error) {
    throw new Error(`Invalid ${label}: expected JSON.`, { cause: error });
  }
  return parsed;
}

function parseIssueList(output) {
  const parsed = parseJson(output, "GitLab issue list result");
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid GitLab issue list result: expected an array.");
  }
  return parsed;
}

function parseIssueView(output) {
  const parsed = parseJson(output, "GitLab issue view result");
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid GitLab issue view result: expected an object.");
  }
  return parsed;
}

function parseCreatedIssue(output) {
  const text = String(output).trim();
  if (!text) throw new Error("Failed to parse GitLab issue IID from empty glab output.");
  if (text.startsWith("{") || text.startsWith("[")) {
    const parsed = parseJson(text, "GitLab issue create result");
    const issue = Array.isArray(parsed) ? parsed[0] : parsed;
    if (issue && typeof issue === "object") {
      return gitlabIdentity(issueIid(issue), issueUrl(issue));
    }
  }
  const match = text.match(GITLAB_ISSUE_URL_RE) || text.match(/gitlab#([1-9]\d*)/i);
  if (!match) {
    throw new Error(`Failed to parse GitLab issue IID from glab output: ${text}`);
  }
  const urlMatch = text.match(/https?:\/\/\S+\/(?:-\/)?issues\/[1-9]\d*/);
  return gitlabIdentity(match[1], urlMatch ? urlMatch[0] : undefined);
}

function availabilityReason(error) {
  if (error && error.code === "ENOENT") {
    return "glab CLI not found (ENOENT); install glab from https://gitlab.com/gitlab-org/cli and run glab auth login";
  }
  const message = error instanceof Error && error.message ? error.message : String(error);
  return `glab CLI probe failed: ${message}`;
}

function repoArgs(repo) {
  return repo ? ["--repo", String(repo)] : [];
}

function listStateArgs(state) {
  if (state === "closed") return ["--closed"];
  if (state === "all") return ["--all"];
  return [];
}

function createGitlabAdapter({ execFile = execFileSync, listTransport } = {}) {
  const run = (args) => execFile(GLAB_BIN, args, GLAB_EXEC_DEFAULTS);

  return Object.freeze({
    availability() {
      try {
        run(["version"]);
      } catch (error) {
        return { available: false, reason: availabilityReason(error) };
      }
      try {
        run(["auth", "status"]);
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : String(error);
        return {
          available: false,
          reason: `glab is not authenticated: ${message}`,
        };
      }
      return { available: true };
    },
    capabilities() {
      // Under-declare: glab issue view JSON does not carry notes, so comments
      // and Agent Brief via notes are not supported until a notes API path
      // lands; issue body remains authority. glab can assign milestones, but
      // sprint-init's milestone seed helpers are GitHub-only. Merge-request
      // relationships are not the named pull-request-relationships capability.
      // Forgejo/Gitea are follow-ups.
      return ["closing-semantics"];
    },
    list({ state = "open", limit, repo } = {}) {
      if (listTransport) {
        const transported = listTransport({ state, limit, repo });
        if (!Array.isArray(transported)) {
          throw new Error("Invalid GitLab issue list result: expected an array.");
        }
        return transported.map(normalizeGitlabTask);
      }
      const args = ["issue", "list", ...listStateArgs(state), "--output", "json"];
      if (limit !== undefined) args.push("--per-page", String(limit));
      args.push(...repoArgs(repo));
      return parseIssueList(run(args)).map(normalizeGitlabTask);
    },
    read(taskIdentity, { repo } = {}) {
      const identity = identityFrom(taskIdentity);
      const args = [
        "issue", "view", identity.id,
        "--output", "json",
        ...repoArgs(repo),
      ];
      return normalizeGitlabTask(parseIssueView(run(args)));
    },
    create({ title, body, description, repo } = {}) {
      if (typeof title !== "string" || !title.trim()) {
        throw new Error("GitLab task creation requires a non-empty title.");
      }
      const desc = description ?? body ?? "";
      const args = [
        "issue", "create",
        "--title", title,
        "--description", String(desc),
        "--yes", "--no-editor",
        ...repoArgs(repo),
      ];
      return parseCreatedIssue(run(args));
    },
    update(taskIdentity, changes = {}) {
      const identity = identityFrom(taskIdentity);
      const args = ["issue", "update", identity.id];
      if (changes.title !== undefined) args.push("--title", String(changes.title));
      const desc = changes.description ?? changes.body;
      if (desc !== undefined) args.push("--description", String(desc));
      for (const label of changes.addLabels || []) args.push("--label", String(label));
      for (const label of changes.removeLabels || []) args.push("--unlabel", String(label));
      if (changes.repo) args.push("--repo", String(changes.repo));
      if (args.length > 3) run(args);
      return identity;
    },
    close(taskIdentity, { repo } = {}) {
      const identity = identityFrom(taskIdentity);
      const args = ["issue", "close", identity.id, ...repoArgs(repo)];
      run(args);
      return identity;
    },
  });
}

module.exports = {
  GLAB_BIN,
  GLAB_EXEC_DEFAULTS,
  createGitlabAdapter,
  gitlabIdentity,
  identityFrom,
  normalizeGitlabTask,
  parseCreatedIssue,
  parseIssueList,
  parseIssueView,
};
