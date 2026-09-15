/**
 * Files (Backlog.md CLI) implementation of the required seven-operation
 * tracker lifecycle. Port contract: references/adapter-ports.md.
 *
 * Task storage stays with the `backlog` binary (npm package `backlog.md`).
 * This adapter never reads or writes `backlog/tasks/*.md` as a product API.
 */

const { execFileSync } = require("child_process");

const FILES_EXEC_DEFAULTS = {
  encoding: "utf-8",
  maxBuffer: 50 * 1024 * 1024,
};
const DEFAULT_TASK_PREFIX = "BACK";
const FILES_ID_RE = /^[1-9]\d*(?:\.[1-9]\d*)?$/;
const BACKLOG_BIN = "backlog";

function stripTaskPrefix(rawId, prefix = DEFAULT_TASK_PREFIX) {
  const value = String(rawId ?? "").trim();
  const head = `${prefix}-`;
  if (value.length > head.length && value.slice(0, head.length).toUpperCase() === head.toUpperCase()) {
    return value.slice(head.length);
  }
  return value;
}

function filesIdentity(rawId, { prefix = DEFAULT_TASK_PREFIX, url } = {}) {
  const id = stripTaskPrefix(rawId, prefix);
  if (!FILES_ID_RE.test(id)) {
    throw new Error(`Invalid files task id: ${rawId}`);
  }
  const identity = { tracker: "files", id, ref: `${prefix}-${id}` };
  if (url !== undefined && url !== null && url !== "") {
    let parsed;
    try {
      parsed = new URL(String(url));
    } catch {
      throw new Error(`Invalid files task URL: ${url}`);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error(`Invalid files task URL: ${url}`);
    }
    identity.url = String(url);
  }
  return identity;
}

function normalizeFilesTask(task, { prefix = DEFAULT_TASK_PREFIX } = {}) {
  if (task === null || typeof task !== "object" || Array.isArray(task)) {
    throw new Error("Invalid files task result: expected an object.");
  }
  const identity = filesIdentity(task.id, { prefix, url: task.url });
  const description = task.description ?? task.body ?? "";
  const body = task.body ?? task.description ?? "";
  return {
    ...task,
    ...identity,
    title: task.title,
    description,
    body,
    status: task.status,
    acceptanceCriteria: task.acceptanceCriteria ?? [],
    labels: task.labels ?? [],
  };
}

function identityFrom(value, { prefix = DEFAULT_TASK_PREFIX } = {}) {
  if (typeof value === "number" || typeof value === "string") {
    return filesIdentity(String(value), { prefix });
  }
  if (value === null || typeof value !== "object" || value.tracker !== "files") {
    throw new Error("Files lifecycle operation requires a files task identity.");
  }
  const identity = filesIdentity(value.id, { prefix, url: value.url });
  if (value.ref !== identity.ref) throw new Error(`Invalid files task ref: ${value.ref}`);
  return identity;
}

function parseJsonObject(output, label) {
  let parsed;
  try {
    parsed = JSON.parse(String(output));
  } catch (error) {
    throw new Error(`Invalid ${label}: expected JSON.`, { cause: error });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid ${label}: expected an object.`);
  }
  return parsed;
}

function parseTaskListEnvelope(output) {
  const parsed = parseJsonObject(output, "files task list result");
  if (parsed.kind !== "task-list" || !Array.isArray(parsed.tasks)) {
    throw new Error('Invalid files task list result: expected { kind: "task-list", tasks: [...] }.');
  }
  return parsed.tasks;
}

function parseTaskViewEnvelope(output) {
  const parsed = parseJsonObject(output, "files task view result");
  if (
    parsed.kind !== "task-view" ||
    parsed.task === null ||
    typeof parsed.task !== "object" ||
    Array.isArray(parsed.task)
  ) {
    throw new Error('Invalid files task view result: expected { kind: "task-view", task: {...} }.');
  }
  return parsed.task;
}

function parseCreatedTask(output, { prefix = DEFAULT_TASK_PREFIX } = {}) {
  const text = String(output).trim();
  if (!text) {
    throw new Error("Failed to parse files task id from empty backlog output.");
  }
  if (text.startsWith("{")) {
    const parsed = parseJsonObject(text, "files task create result");
    if (parsed.kind === "task-view" && parsed.task) {
      return filesIdentity(parsed.task.id, { prefix, url: parsed.task.url });
    }
    if (parsed.id !== undefined) return filesIdentity(parsed.id, { prefix, url: parsed.url });
  }
  const match = text.match(new RegExp(`\\b${prefix}-([1-9]\\d*(?:\\.[1-9]\\d*)?)\\b`, "i"));
  if (!match) {
    throw new Error(`Failed to parse files task id from backlog output: ${text}`);
  }
  return filesIdentity(match[1], { prefix });
}

function availabilityReason(error) {
  if (error && error.code === "ENOENT") {
    return "backlog CLI not found (ENOENT); install the backlog.md package so `backlog` is on PATH";
  }
  const message = error instanceof Error && error.message ? error.message : String(error);
  return `backlog CLI probe failed: ${message}`;
}

function listStatusFlag({ state, status } = {}) {
  if (typeof status === "string" && status.trim()) return status;
  if (state === "closed") return "Done";
  if (state && state !== "open" && state !== "all") return state;
  return undefined;
}

function acceptanceCriteriaArgs(value) {
  if (value === undefined) return [];
  const items = Array.isArray(value) ? value : [value];
  const args = [];
  for (const item of items) args.push("--ac", String(item));
  return args;
}

function createFilesAdapter({
  execFile = execFileSync,
  taskPrefix = DEFAULT_TASK_PREFIX,
} = {}) {
  const prefix = taskPrefix;
  const run = (args) => execFile(BACKLOG_BIN, args, FILES_EXEC_DEFAULTS);

  return Object.freeze({
    availability() {
      try {
        const output = run(["task", "list", "--json", "--limit", "1"]);
        const parsed = JSON.parse(String(output));
        if (
          parsed === null ||
          typeof parsed !== "object" ||
          parsed.kind !== "task-list" ||
          !Array.isArray(parsed.tasks)
        ) {
          return {
            available: false,
            reason: "backlog CLI probe returned an unexpected JSON envelope",
          };
        }
        return { available: true };
      } catch (error) {
        return { available: false, reason: availabilityReason(error) };
      }
    },
    capabilities() {
      return ["comments"];
    },
    list(options = {}) {
      const args = ["task", "list", "--json"];
      const status = listStatusFlag(options);
      if (status) args.push("--status", status);
      if (options.limit !== undefined) args.push("--limit", String(options.limit));
      const tasks = parseTaskListEnvelope(run(args)).map((task) => normalizeFilesTask(task, { prefix }));
      if (options.state === "open" && !status) {
        return tasks.filter((task) => String(task.status || "").toLowerCase() !== "done");
      }
      return tasks;
    },
    read(taskIdentity) {
      const identity = identityFrom(taskIdentity, { prefix });
      const output = run(["task", "view", identity.id, "--json"]);
      return normalizeFilesTask(parseTaskViewEnvelope(output), { prefix });
    },
    create({ title, body, description, acceptanceCriteria } = {}) {
      if (typeof title !== "string" || !title.trim()) {
        throw new Error("Files task creation requires a non-empty title.");
      }
      const args = ["task", "create", title];
      const desc = description ?? body;
      if (desc !== undefined) args.push("-d", String(desc));
      args.push(...acceptanceCriteriaArgs(acceptanceCriteria));
      return parseCreatedTask(run(args), { prefix });
    },
    update(taskIdentity, changes = {}) {
      const identity = identityFrom(taskIdentity, { prefix });
      const args = ["task", "edit", identity.id];
      if (changes.title !== undefined) args.push("-t", String(changes.title));
      const desc = changes.description ?? changes.body;
      if (desc !== undefined) args.push("-d", String(desc));
      if (changes.status !== undefined) args.push("-s", String(changes.status));
      args.push(...acceptanceCriteriaArgs(changes.acceptanceCriteria));
      if (args.length > 3) run(args);
      return identity;
    },
    close(taskIdentity) {
      const identity = identityFrom(taskIdentity, { prefix });
      run(["task", "edit", identity.id, "-s", "Done"]);
      return identity;
    },
  });
}

module.exports = {
  BACKLOG_BIN,
  DEFAULT_TASK_PREFIX,
  FILES_EXEC_DEFAULTS,
  createFilesAdapter,
  filesIdentity,
  identityFrom,
  normalizeFilesTask,
  parseCreatedTask,
  parseTaskListEnvelope,
  parseTaskViewEnvelope,
};
