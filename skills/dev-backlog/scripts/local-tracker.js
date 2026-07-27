/**
 * Local JSON storage substrate for the required tracker lifecycle.
 *
 * `backlog/local-tracker.json` is the only task authority. Markdown below
 * `backlog/tasks/` and `backlog/completed/` is a derived, one-way projection
 * with the same shape as GitHub issue mirrors. No lifecycle operation parses a
 * mirror back into the store.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { readConfig, slugify, escapeYaml } = require("./lib.js");
const { parseTaskRef, parseTaskFileName } = require("./task-ref.js");

const STORE_FILE = "local-tracker.json";
const TASKS_DIR = "tasks";
const COMPLETED_DIR = "completed";
const DONE_STATUS = "Done";
const STORE_VERSION = 1;
const CAS_RETRIES = 100;
const REVISION_TEMP_RE = /^\.local-tracker\.revision-(\d+)\..+\.tmp$/;

const CREATE_OPTIONS = Object.freeze([
  "title", "id", "body", "status", "labels", "priority", "dependencies",
]);
const UPDATE_OPTIONS = Object.freeze([
  "title", "status", "priority", "labels", "dependencies", "body", "updated_date",
]);
const LIST_STATES = Object.freeze(["open", "closed", "all"]);
const SCALAR_FIELDS = Object.freeze([
  "title", "status", "priority", "milestone", "created_date", "updated_date",
]);
const LIST_FIELDS = Object.freeze(["labels", "dependencies"]);
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/;
class LocalStoreError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "LocalStoreError";
    this.tracker = "local";
  }
}
function rejectUnsupportedOptions(operation, options, allowed) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) return;
  const extra = Object.keys(options).filter((key) => !allowed.includes(key));
  if (extra.length) {
    throw new LocalStoreError(
      `local ${operation} does not support option${extra.length === 1 ? "" : "s"}: ` +
        `${extra.join(", ")}. The local tracker reports no optional capabilities, so ` +
        "provider-specific fields must be handled before dispatch."
    );
  }
}
function taskPrefixIssue(prefix) {
  if (typeof prefix !== "string" || !prefix.length) return "task_prefix must be a non-empty string";
  if (/[\s/\\\0]/.test(prefix)) return (
    `task_prefix ${JSON.stringify(prefix)} must not contain whitespace, path separators, or NUL`
  );
  if (prefix.includes("..")) return (
    `task_prefix ${JSON.stringify(prefix)} must not contain traversal segments`
  );
  return null;
}
function assertNoControlChars(field, value) {
  if (CONTROL_CHAR_RE.test(value)) {
    throw new LocalStoreError(
      `local ${field} must not contain newlines or control characters; ` +
        "they would inject mirror frontmatter or corrupt task metadata"
    );
  }
}
function cleanScalar(field, value, { nonEmpty = false } = {}) {
  const text = String(value);
  assertNoControlChars(field, text);
  if (nonEmpty && !text.trim()) {
    throw new LocalStoreError(`local ${field} must be a non-empty scalar`);
  }
  return text;
}
function cleanList(field, value) {
  if (!Array.isArray(value)) throw new LocalStoreError(`local ${field} must be an array`);
  return value.map((item) => cleanScalar(`${field} item`, item));
}
function emptyStore() { return { version: STORE_VERSION, revision: 0, tasks: [] }; }
function compareByParentThenSub(left, right) {
  const key = (id) => {
    const [parent, sub] = id.split(".");
    return [BigInt(parent), sub === undefined ? -1n : BigInt(sub)];
  };
  const [lp, ls] = key(left.id);
  const [rp, rs] = key(right.id);
  if (lp !== rp) return lp < rp ? -1 : 1;
  if (ls !== rs) return ls < rs ? -1 : 1;
  return 0;
}
function createLocalAdapter(options = {}) {
  const backlogDir = options.backlogDir;
  const now = options.now || (() => new Date());
  const config = options.config || readConfig(backlogDir);
  const taskPrefix = config.task_prefix ?? "BACK";
  const defaultStatus = config.default_status ?? "To Do";
  const prefixIssue = taskPrefixIssue(taskPrefix);
  const testHooks = options.testHooks || {};
  const refOptions = { taskPrefix };
  const storePath = path.join(backlogDir || "", STORE_FILE);
  const requestedRetries = options.cas?.retries;
  const casRetries = Number.isSafeInteger(requestedRetries)
    ? Math.max(0, Math.min(requestedRetries, CAS_RETRIES)) : CAS_RETRIES;
  function identityForId(id) { return parseTaskRef(`${taskPrefix}-${id}`, refOptions); }
  function assertUsablePrefix() {
    if (prefixIssue) throw new LocalStoreError(`local tracker ${prefixIssue}`);
  }
  function resolveIdentity(selector) {
    if (selector && typeof selector === "object" && !Array.isArray(selector)) {
      if (selector.tracker !== "local") {
        throw new LocalStoreError("local read/update/close requires a local task identity");
      }
      const identity = identityForId(String(selector.id));
      if (!identity) throw new LocalStoreError(`invalid local task id: ${String(selector.id)}`);
      if (selector.ref !== undefined && selector.ref !== identity.ref) {
        throw new LocalStoreError(`local task ref ${selector.ref} does not match ${identity.ref}`);
      }
      return identity;
    }
    if (typeof selector === "string") {
      const byRef = parseTaskRef(selector, refOptions);
      if (byRef?.tracker === "local") return byRef;
      const byId = identityForId(selector);
      if (byId) return byId;
    }
    throw new LocalStoreError(`unresolved local task selector: ${String(selector)}`);
  }
  function pathIssue(target, kind) {
    let stat;
    try {
      stat = fs.lstatSync(target);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      return `local ${kind} path ${target} is unusable: ${error.message}`;
    }
    if (stat.isSymbolicLink()) return `local ${kind} path ${target} must not be a symlink`;
    if (kind === "store" && !stat.isFile()) return `local store path ${target} is not a regular file`;
    if (kind !== "store" && !stat.isDirectory()) return `local ${kind} path ${target} is not a directory`;
    return null;
  }
  function canonicalPathIssue() {
    if (typeof backlogDir !== "string" || !backlogDir.trim()) {
      return "local tracker backlogDir is not configured";
    }
    for (const [target, kind] of [
      [backlogDir, "backlog"],
      [path.join(backlogDir, TASKS_DIR), TASKS_DIR],
      [path.join(backlogDir, COMPLETED_DIR), COMPLETED_DIR],
      [storePath, "store"],
    ]) {
      const issue = pathIssue(target, kind);
      if (issue) return issue;
    }
    return null;
  }
  function assertCanonicalPaths() {
    const issue = canonicalPathIssue();
    if (issue) throw new LocalStoreError(issue);
  }
  function validateRecord(record, seen) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new LocalStoreError("local JSON store is malformed: every task must be an object");
    }
    if (typeof record.id !== "string" || !identityForId(record.id)) {
      throw new LocalStoreError(`local JSON store has an invalid task id: ${String(record.id)}`);
    }
    if (seen.has(record.id)) {
      throw new LocalStoreError(
        `local JSON store is corrupt: ${taskPrefix}-${record.id} appears more than once`
      );
    }
    seen.add(record.id);
    if (!["open", "closed"].includes(record.state)) {
      throw new LocalStoreError(
        `local task ${taskPrefix}-${record.id} has invalid state ${JSON.stringify(record.state)}`
      );
    }
    if (typeof record.body !== "string") {
      throw new LocalStoreError(`local task ${taskPrefix}-${record.id} has a non-string body`);
    }
    for (const field of SCALAR_FIELDS) {
      if (typeof record[field] !== "string") {
        throw new LocalStoreError(
          `local task ${taskPrefix}-${record.id} has a non-string ${field}`
        );
      }
      cleanScalar(field, record[field], { nonEmpty: field === "title" || field === "status" });
    }
    for (const field of LIST_FIELDS) cleanList(field, record[field]);
    return record;
  }
  function validateStore(store) {
    if (!store || typeof store !== "object" || Array.isArray(store)) {
      throw new LocalStoreError("local JSON store is malformed: expected an object");
    }
    if (
      store.version !== STORE_VERSION ||
      !Number.isSafeInteger(store.revision) ||
      store.revision < 0 ||
      !Array.isArray(store.tasks)
    ) {
      throw new LocalStoreError(
        `local JSON store is malformed: expected version ${STORE_VERSION}, a non-negative ` +
          "integer revision, and a tasks array"
      );
    }
    const seen = new Set();
    for (const record of store.tasks) validateRecord(record, seen);
    return store;
  }
  function readStore() {
    assertCanonicalPaths();
    let raw;
    try {
      raw = fs.readFileSync(storePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") return emptyStore();
      throw new LocalStoreError(`cannot read local JSON store: ${error.message}`, { cause: error });
    }
    try {
      return validateStore(JSON.parse(raw));
    } catch (error) {
      if (error instanceof LocalStoreError) throw error;
      throw new LocalStoreError(`local JSON store is malformed: ${error.message}`, { cause: error });
    }
  }
  function tempPath(dir, label) {
    return path.join(
      dir,
      `.local-tracker.${process.pid}.${label}.${crypto.randomBytes(8).toString("hex")}.tmp`
    );
  }
  function writeCompleteTemp(tmp, content, hook) {
    if (hook) return hook(tmp, content);
    const fd = fs.openSync(tmp, "wx", 0o666);
    try {
      fs.writeFileSync(fd, content, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  }
  function fsyncDirectory(dir, target) {
    if (testHooks.beforeDirectoryFsync) testHooks.beforeDirectoryFsync(dir, target);
    let fd;
    try {
      fd = fs.openSync(dir, "r");
      fs.fsyncSync(fd);
    } catch (error) {
      // Windows and some filesystems refuse directory handles/fsync. The rename
      // is still atomic there, so degrade durability rather than fail the write.
      if (!["EACCES", "EBADF", "EISDIR", "EINVAL", "ENOSYS", "ENOTSUP", "EPERM"].includes(error.code)) throw error;
    } finally {
      try { if (fd !== undefined) fs.closeSync(fd); } catch {}
    }
  }
  function replaceAtomic(target, content, hookName) {
    const dir = path.dirname(target);
    const issue = pathIssue(dir, path.basename(dir));
    if (issue) throw new LocalStoreError(issue);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = tempPath(dir, path.basename(target).replace(/[^A-Za-z0-9.-]/g, "_"));
    try {
      writeCompleteTemp(tmp, content, testHooks[hookName]);
      if (hookName === "writeMirrorTemp" && testHooks.beforeMirrorRename) {
        testHooks.beforeMirrorRename(tmp, target);
      }
      fs.renameSync(tmp, target);
      fsyncDirectory(dir, target);
    } catch (error) {
      throw error instanceof LocalStoreError
        ? error
        : new LocalStoreError(`cannot atomically replace ${target}: ${error.message}`, { cause: error });
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        // A successful rename consumed the temp; a failed partial write is cleaned.
      }
    }
  }
  function revisionPath(revision) {
    return path.join(backlogDir, `.local-tracker.revision-${revision}.json`);
  }

  function revisionTempPath(revision) {
    const token = crypto.randomBytes(8).toString("hex");
    return path.join(backlogDir, `.local-tracker.revision-${revision}.${process.pid}.${token}.tmp`);
  }
  function finishClaim(claimPath, revision) {
    const currentRevision = readStore().revision;
    if (currentRevision !== revision - 1) return;
    try { fs.renameSync(claimPath, storePath); fsyncDirectory(backlogDir, storePath); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      // The claimant or another helper already completed this exact revision.
    }
  }
  function cleanRevisionDebris(currentRevision) {
    for (const name of fs.readdirSync(backlogDir)) {
      const match = name.match(REVISION_TEMP_RE);
      if (!match || Number(match[1]) > currentRevision) continue;
      try { fs.unlinkSync(path.join(backlogDir, name)); }
      catch (error) {
        if (!["ENOENT", "EBUSY", "EPERM"].includes(error.code)) throw error;
      }
    }
  }
  function publishStore(store, baseRevision) {
    validateStore(store);
    assertCanonicalPaths();
    fs.mkdirSync(backlogDir, { recursive: true });
    const revision = baseRevision + 1;
    const claimPath = revisionPath(revision);
    const tmp = revisionTempPath(revision);
    const content = `${JSON.stringify(store, null, 2)}\n`;
    try {
      writeCompleteTemp(tmp, content, testHooks.writeStoreTemp);
      if (testHooks.beforeRevisionClaim) testHooks.beforeRevisionClaim(tmp, claimPath);
      try {
        (testHooks.linkRevision || fs.linkSync)(tmp, claimPath);
      } catch (error) {
        if (error.code === "EEXIST") {
          finishClaim(claimPath, revision);
          return false;
        }
        // A winning writer may remove a stale contender's temp during cleanup.
        if (error.code === "ENOENT") return false;
        throw error;
      }
      if (testHooks.afterRevisionClaim) testHooks.afterRevisionClaim(claimPath, storePath);

      const currentRevision = readStore().revision;
      if (currentRevision !== baseRevision) {
        // A helper can publish our complete claim before this recheck. Missing
        // means that exact candidate won; an extant path is our stale claim.
        if (!fs.existsSync(claimPath)) return true;
        fs.unlinkSync(claimPath);
        return false;
      }
      try { fs.renameSync(claimPath, storePath); fsyncDirectory(backlogDir, storePath); }
      catch (error) {
        if (error.code !== "ENOENT") throw error;
        // Another writer helped this content-complete claim across the window.
      }
      return true;
    } catch (error) {
      throw error instanceof LocalStoreError
        ? error
        : new LocalStoreError(
            `cannot compare-and-swap local store revision ${revision}: ${error.message}`,
            { cause: error }
          );
    } finally {
      try { fs.unlinkSync(tmp); } catch {}
    }
  }

  function bodyForMirror(body) {
    const text = String(body);
    const core = text.replace(/^\n/, "").replace(/\n$/, "");
    if (!core) return "\n## Description\n(No description provided)\n";
    if (/^##\s+Description/m.test(core)) return `\n${core}\n`;
    return `\n## Description\n${core}\n`;
  }

  function mirrorName(record) {
    const slug = slugify(record.title) || record.id;
    return `${taskPrefix}-${record.id} - ${slug}.md`;
  }

  function renderMirror(record) {
    const labels = record.labels.length
      ? `\n${record.labels.map((label) => `  - ${escapeYaml(label)}`).join("\n")}`
      : " []";
    return [
      "---",
      `id: ${taskPrefix}-${record.id}`,
      `title: ${escapeYaml(record.title)}`,
      `status: ${escapeYaml(record.status)}`,
      `labels:${labels}`,
      `priority: ${escapeYaml(record.priority)}`,
      `milestone: ${escapeYaml(record.milestone)}`,
      `created_date: '${record.created_date}'`,
      "---",
    ].join("\n") + bodyForMirror(record.body);
  }

  function refreshMirrorDir(kind, records) {
    const dir = path.join(backlogDir, kind);
    const issue = pathIssue(dir, kind);
    if (issue) throw new LocalStoreError(issue);
    fs.mkdirSync(dir, { recursive: true });
    const expected = new Set();
    for (const record of records) {
      const name = mirrorName(record);
      expected.add(name);
      replaceAtomic(path.join(dir, name), renderMirror(record), "writeMirrorTemp");
    }
    for (const name of fs.readdirSync(dir)) {
      if (expected.has(name)) continue;
      if (!parseTaskFileName(name, { taskPrefix, tracker: "local" })) continue;
      fs.unlinkSync(path.join(dir, name));
    }
  }

  function refreshMirrors(store) {
    if (testHooks.beforeMirrorRefresh) testHooks.beforeMirrorRefresh();
    refreshMirrorDir(TASKS_DIR, store.tasks.filter((task) => task.state === "open"));
    refreshMirrorDir(COMPLETED_DIR, store.tasks.filter((task) => task.state === "closed"));
  }

  function commitMutation(mutate) {
    for (let attempt = 0; attempt <= casRetries; attempt += 1) {
      const store = readStore();
      const outcome = mutate(store);
      if (!outcome.changed) {
        refreshMirrors(readStore());
        return outcome.value;
      }
      const baseRevision = store.revision;
      store.revision += 1;
      if (!publishStore(store, baseRevision)) continue;
      cleanRevisionDebris(store.revision);
      refreshMirrors(readStore());
      return outcome.value;
    }
    throw new LocalStoreError(
      `local store compare-and-swap exhausted after ${casRetries + 1} attempts; ` +
        "concurrent writers kept claiming newer revisions, so no unconditional write was made"
    );
  }

  function identityResult(id) {
    const identity = identityForId(id);
    return { tracker: "local", id: identity.id, ref: identity.ref };
  }

  function normalizedTask(record) {
    return {
      ...identityResult(record.id),
      title: record.title,
      status: record.status,
      labels: [...record.labels],
      priority: record.priority,
      dependencies: [...record.dependencies],
      created_date: record.created_date,
      updated_date: record.updated_date,
      body: record.body,
      state: record.state,
    };
  }

  function dateToday() {
    return now().toISOString().slice(0, 10);
  }

  function allocateParentId(store) {
    let max = 0n;
    for (const task of store.tasks) {
      const parent = BigInt(task.id.split(".")[0]);
      if (parent > max) max = parent;
    }
    return String(max + 1n);
  }

  function buildUpdate(changes) {
    const update = {};
    for (const field of ["title", "status", "priority"]) {
      if (changes[field] !== undefined) {
        update[field] = cleanScalar(field, changes[field], {
          nonEmpty: field === "title" || field === "status",
        });
      }
    }
    for (const field of LIST_FIELDS) {
      if (changes[field] !== undefined) update[field] = cleanList(field, changes[field]);
    }
    if (changes.updated_date !== undefined) {
      update.updated_date = cleanScalar("updated_date", changes.updated_date);
    }
    if (changes.body !== undefined) update.body = bodyForMirror(changes.body);
    return update;
  }

  function availability() {
    if (prefixIssue) return { available: false, reason: `local tracker ${prefixIssue}` };
    const issue = canonicalPathIssue();
    if (issue) return { available: false, reason: issue };
    try {
      readStore();
      return { available: true };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }

  function capabilities() { return []; }

  function list({ state = "open" } = {}) {
    if (!LIST_STATES.includes(state)) {
      throw new LocalStoreError(
        `invalid local list state ${JSON.stringify(state)}; expected one of open, closed, all`
      );
    }
    const store = readStore();
    return store.tasks
      .filter((task) => state === "all" || task.state === state)
      .map(normalizedTask)
      .sort(compareByParentThenSub);
  }

  function read(selector) {
    const identity = resolveIdentity(selector);
    const record = readStore().tasks.find((task) => task.id === identity.id);
    if (!record) throw new LocalStoreError(`local task not found: ${identity.ref}`);
    return normalizedTask(record);
  }

  function create(input = {}) {
    rejectUnsupportedOptions("create", input, CREATE_OPTIONS);
    assertUsablePrefix();
    if (typeof input.title !== "string" || !input.title.trim()) {
      throw new LocalStoreError("local task creation requires a non-empty title");
    }
    const title = cleanScalar("title", input.title, { nonEmpty: true });
    const status = cleanScalar("status", input.status ?? defaultStatus, { nonEmpty: true });
    const priority = cleanScalar("priority", input.priority ?? "medium");
    const labels = input.labels === undefined ? [] : cleanList("labels", input.labels);
    const dependencies =
      input.dependencies === undefined ? [] : cleanList("dependencies", input.dependencies);
    let requestedId;
    if (input.id !== undefined && input.id !== null) {
      const parsed = identityForId(String(input.id));
      if (!parsed) throw new LocalStoreError(`invalid explicit local task id: ${String(input.id)}`);
      requestedId = parsed.id;
    }

    return commitMutation((store) => {
      const id = requestedId ?? allocateParentId(store);
      if (store.tasks.some((task) => task.id === id)) {
        throw new LocalStoreError(`local task ${taskPrefix}-${id} already exists`);
      }
      const created = dateToday();
      store.tasks.push({
        id, title, status, labels, priority, dependencies, milestone: "",
        created_date: created, updated_date: created,
        body: bodyForMirror(input.body ?? ""), state: "open",
      });
      return { changed: true, value: identityResult(id) };
    });
  }

  function update(selector, changes = {}) {
    rejectUnsupportedOptions("update", changes, UPDATE_OPTIONS);
    assertUsablePrefix();
    const identity = resolveIdentity(selector);
    const updateFields = buildUpdate(changes);
    return commitMutation((store) => {
      const record = store.tasks.find((task) => task.id === identity.id);
      if (!record || record.state !== "open") {
        throw new LocalStoreError(`no active local task to update: ${identity.ref}`);
      }
      const changed = Object.entries(updateFields).some(
        ([key, value]) => JSON.stringify(record[key]) !== JSON.stringify(value)
      );
      Object.assign(record, updateFields);
      return { changed, value: identityResult(identity.id) };
    });
  }

  function close(selector, closeOptions = {}) {
    rejectUnsupportedOptions("close", closeOptions, []);
    assertUsablePrefix();
    const identity = resolveIdentity(selector);
    return commitMutation((store) => {
      const record = store.tasks.find((task) => task.id === identity.id);
      if (!record) throw new LocalStoreError(`local task not found: ${identity.ref}`);
      const changed = record.state === "open";
      if (changed) Object.assign(record, { state: "closed", status: DONE_STATUS });
      return { changed, value: identityResult(identity.id) };
    });
  }

  return Object.freeze({ availability, capabilities, list, read, create, update, close });
}

module.exports = {
  STORE_FILE,
  createLocalAdapter,
  LocalStoreError,
};
