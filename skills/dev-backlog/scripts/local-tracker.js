/**
 * Local filesystem implementation of the required seven-operation tracker
 * lifecycle.
 *
 * This module is the single owner of every local-store rule: task filenames,
 * frontmatter grammar, body preservation, ID allocation, and the atomic
 * publication primitives. Callers only ever see the seven operations and the
 * normalized `{ tracker: "local", id, ref }` identity — no URL, no filename,
 * and no frontmatter leak across the seam.
 *
 * Canonical tasks live in `backlog/tasks/` (open) and `backlog/completed/`
 * (closed) as Backlog.md-compatible `{PREFIX}-{N}[.M] - {slug}.md` files. The
 * adapter never invokes `gh`, opens a network socket, reads GitHub state, or
 * falls back to another tracker: local selection is authoritative.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { readConfig, slugify, escapeYaml, parseSimpleYaml } = require("./lib.js");
const {
  parseTaskRef,
  parseTaskFileName,
} = require("./task-ref.js");

const TASKS_DIR = "tasks";
const COMPLETED_DIR = "completed";
const LOCK_FILE = ".local-tracker.lock";
const DONE_STATUS = "Done";
const DEFAULT_LOCK = Object.freeze({ retries: 100, delayMs: 20 });

// Only provider-neutral fields are accepted; every other option (milestone,
// pull-request relationship, mirror, progress issue, comment, closing reason,
// …) maps to an optional capability the local store does not have and must be
// rejected before any mutation rather than silently ignored.
const CREATE_OPTIONS = Object.freeze([
  "title",
  "id",
  "body",
  "status",
  "labels",
  "priority",
  "dependencies",
]);
const UPDATE_OPTIONS = Object.freeze([
  "title",
  "status",
  "priority",
  "labels",
  "dependencies",
  "body",
  "updated_date",
]);
const CLOSE_OPTIONS = Object.freeze([]);

function rejectUnsupportedOptions(operation, options, allowed) {
  if (options === null || typeof options !== "object") return;
  const extra = Object.keys(options).filter((key) => !allowed.includes(key));
  if (extra.length) {
    throw new LocalStoreError(
      `local ${operation} does not support option${extra.length === 1 ? "" : "s"}: ` +
        `${extra.join(", ")}. The local tracker reports no optional capabilities, so ` +
        "provider-specific fields must be handled before dispatch."
    );
  }
}

/** Every recoverable local-store failure surfaces as this actionable type. */
class LocalStoreError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "LocalStoreError";
    this.tracker = "local";
  }
}

// --- synchronous timing primitive (no busy spin) ---

function sleepSync(ms) {
  if (!(ms > 0)) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// --- frontmatter / body split, preserving human bytes verbatim ---

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*|$)/;

function splitDocument(content) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;
  return { frontmatter: match[1], body: match[2] };
}

/**
 * Parse a frontmatter block into ordered entries. Each entry keeps its raw
 * source lines so untouched keys are re-emitted byte-for-byte on update.
 */
function parseFrontmatterEntries(frontmatter) {
  const entries = [];
  let current = null;
  for (const line of frontmatter.split("\n")) {
    const isKey = /^[A-Za-z0-9_-]+:/.test(line) && !/^\s/.test(line);
    if (isKey) {
      if (current) entries.push(current);
      current = { key: line.slice(0, line.indexOf(":")), lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) entries.push(current);
  return entries;
}

/**
 * Resolve one entry to its value. Block sequences (`key:` followed by `  - x`
 * lines) are decoded here because the shared simple YAML parser only consumes
 * `key: value` lines and would otherwise return a malformed object for the
 * exact block syntax we render on create/update.
 */
function entryValue(entry) {
  const head = entry.lines[0] || "";
  const colon = head.indexOf(":");
  const inline = colon === -1 ? "" : head.slice(colon + 1).trim();
  if (!inline) {
    const items = [];
    for (const line of entry.lines.slice(1)) {
      const item = line.match(/^\s*-\s+(.*)$/);
      if (item) items.push(unquoteBlockItem(item[1].trim()));
    }
    if (items.length) return items;
  }
  return parseSimpleYaml(entry.lines.join("\n"))[entry.key];
}

function unquoteBlockItem(text) {
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'")))
  ) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  return text;
}

function frontmatterObject(entries) {
  const object = {};
  for (const entry of entries) object[entry.key] = entryValue(entry);
  return object;
}

const DATE_KEYS = new Set(["created_date", "updated_date"]);

function renderScalar(key, value) {
  const text = String(value);
  if (DATE_KEYS.has(key)) return `${key}: '${text}'`;
  return `${key}: ${escapeYaml(text)}`;
}

function renderFieldLines(key, value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${key}: []`];
    return [`${key}:`, ...value.map((item) => `  - ${item}`)];
  }
  return [renderScalar(key, value)];
}

/**
 * Replace only the requested keys; append new keys at the end. Every other
 * entry is emitted from its raw source lines, so unrelated frontmatter and the
 * human body are never re-rendered or reordered.
 */
function applyFrontmatterChanges(entries, changes) {
  const next = entries.map((entry) => ({ ...entry, lines: [...entry.lines] }));
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    const lines = renderFieldLines(key, value);
    const existing = next.find((entry) => entry.key === key);
    if (existing) existing.lines = lines;
    else next.push({ key, lines });
  }
  return next;
}

function stringifyFrontmatter(entries) {
  const inner = entries.flatMap((entry) => entry.lines).join("\n");
  return `---\n${inner}\n---`;
}

/**
 * A task body must be separated from the closing `---` by a newline; otherwise
 * `---body` collapses into the frontmatter fence and the file reads back as
 * malformed. Callers may pass a body without the leading newline, so normalize
 * it here rather than trusting the caller's byte layout.
 */
function normalizeBody(body) {
  return body.startsWith("\n") ? body : `\n${body}`;
}

/**
 * The configured task prefix flows into filenames and identity refs, so it must
 * never carry path separators, traversal, NUL, or whitespace that could steer a
 * write outside the canonical `tasks/` and `completed/` directories. Returns an
 * actionable reason string when the prefix is unusable, or null when it is safe.
 */
function taskPrefixIssue(prefix) {
  if (typeof prefix !== "string" || !prefix.length) {
    return "task_prefix must be a non-empty string";
  }
  if (/[\s/\\\0]/.test(prefix)) {
    return `task_prefix ${JSON.stringify(prefix)} must not contain whitespace, path separators, or NUL`;
  }
  if (prefix.includes("..")) {
    return `task_prefix ${JSON.stringify(prefix)} must not contain traversal segments`;
  }
  return null;
}

// --- normalized task shape ---

function normalizeTask({ identity, object, body, state }) {
  const labels = Array.isArray(object.labels)
    ? object.labels
    : object.labels
      ? [object.labels]
      : [];
  const dependencies = Array.isArray(object.dependencies)
    ? object.dependencies
    : object.dependencies
      ? [object.dependencies]
      : [];
  return {
    tracker: "local",
    id: identity.id,
    ref: identity.ref,
    title: object.title === undefined ? "" : String(object.title),
    status: object.status === undefined ? "" : String(object.status),
    labels,
    priority: object.priority === undefined ? "" : String(object.priority),
    dependencies,
    created_date: object.created_date === undefined ? "" : String(object.created_date),
    updated_date: object.updated_date === undefined ? "" : String(object.updated_date),
    body,
    state,
  };
}

function createLocalAdapter(options = {}) {
  const backlogDir = options.backlogDir;
  const now = options.now || (() => new Date());
  const config = options.config || readConfig(backlogDir);
  const taskPrefix = config.task_prefix || "BACK";
  const defaultStatus = config.default_status || "To Do";
  const lockConfig = { ...DEFAULT_LOCK, ...(options.lock || {}) };
  const testHooks = options.testHooks || {};
  const refOptions = { taskPrefix };
  const prefixIssue = taskPrefixIssue(taskPrefix);

  function assertUsablePrefix() {
    if (prefixIssue) throw new LocalStoreError(`local tracker ${prefixIssue}`);
  }

  function dirPath(kind) {
    return path.join(backlogDir, kind);
  }

  /** Refuse any write whose resolved parent is not exactly the target dir. */
  function assertWithin(dir, dest) {
    if (path.resolve(path.dirname(dest)) !== path.resolve(dir)) {
      throw new LocalStoreError(
        `refusing to write a local task outside its canonical directory: ${dest}`
      );
    }
  }

  function today() {
    return now().toISOString().slice(0, 10);
  }

  // --- identity resolution (no foreign-prefix inference) ---

  function resolveIdentity(selector) {
    if (selector && typeof selector === "object") {
      if (selector.tracker !== "local") {
        throw new LocalStoreError("local read/update/close requires a local task identity");
      }
      const bare = parseTaskRef(`${taskPrefix}-${selector.id}`, refOptions);
      if (!bare) throw new LocalStoreError(`invalid local task id: ${String(selector.id)}`);
      if (selector.ref !== undefined && selector.ref !== bare.ref) {
        throw new LocalStoreError(`local task ref ${selector.ref} does not match ${bare.ref}`);
      }
      return bare;
    }
    if (typeof selector === "string") {
      const asRef = parseTaskRef(selector, refOptions);
      if (asRef && asRef.tracker === "local") return asRef;
      const asId = parseTaskRef(`${taskPrefix}-${selector}`, refOptions);
      if (asId) return asId;
    }
    throw new LocalStoreError(`unresolved local task selector: ${String(selector)}`);
  }

  // --- directory scanning ---

  function listDir(kind) {
    const dir = dirPath(kind);
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw new LocalStoreError(`cannot read local ${kind} directory: ${error.message}`, { cause: error });
    }
    const found = [];
    const byId = new Map();
    for (const name of names) {
      if (!name.endsWith(".md")) continue;
      const identity = parseTaskFileName(name, { taskPrefix, tracker: "local" });
      if (!identity) continue;
      const seen = byId.get(identity.id);
      if (seen) {
        throw new LocalStoreError(
          `local ${kind} store is corrupt: ${identity.ref} is claimed by multiple files ` +
            `(${seen}, ${name}); resolve the duplicate before continuing`
        );
      }
      byId.set(identity.id, name);
      found.push({ identity, file: name });
    }
    return found;
  }

  function findEntry(kind, identity) {
    return listDir(kind).find((entry) => entry.identity.id === identity.id);
  }

  /**
   * Locate one identity across both stores. Presence in both stores is
   * canonical-store corruption (an exact id must be unique store-wide), so the
   * caller decides how to fail rather than silently first-matching.
   */
  function locateEntry(identity) {
    const active = findEntry(TASKS_DIR, identity);
    const completed = findEntry(COMPLETED_DIR, identity);
    if (active && completed) {
      throw new LocalStoreError(
        `local task ${identity.ref} exists in both active and completed stores; ` +
          "an exact id must be unique across the canonical stores"
      );
    }
    return { active, completed };
  }

  function readTask(kind, entry) {
    const full = path.join(dirPath(kind), entry.file);
    const content = fs.readFileSync(full, "utf-8");
    const split = splitDocument(content);
    if (!split) return null;
    const object = frontmatterObject(parseFrontmatterEntries(split.frontmatter));
    if (object.id !== undefined && String(object.id) !== entry.identity.ref) {
      throw new LocalStoreError(
        `local task ${entry.identity.ref} is corrupt: frontmatter id ` +
          `${JSON.stringify(String(object.id))} does not match its filename`
      );
    }
    const state = kind === COMPLETED_DIR ? "closed" : "open";
    return normalizeTask({ identity: entry.identity, object, body: split.body, state });
  }

  // --- allocation critical section ---

  function tempPath(dir, id) {
    const token = crypto.randomBytes(6).toString("hex");
    return path.join(dir, `.local-tracker.${process.pid}.${id}.${token}.tmp`);
  }

  function acquireLock() {
    fs.mkdirSync(backlogDir, { recursive: true });
    const lockPath = path.join(backlogDir, LOCK_FILE);
    for (let attempt = 0; attempt <= lockConfig.retries; attempt += 1) {
      try {
        return fs.openSync(lockPath, "wx");
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw new LocalStoreError(`cannot acquire local allocation lock: ${error.message}`, { cause: error });
        }
        if (attempt < lockConfig.retries) sleepSync(lockConfig.delayMs);
      }
    }
    throw new LocalStoreError(
      "another local allocation holds the store lock; retry once it releases " +
        `(remove ${path.join(backlogDir, LOCK_FILE)} only if you are certain no allocator is running)`
    );
  }

  function releaseLock(fd) {
    const lockPath = path.join(backlogDir, LOCK_FILE);
    try {
      fs.closeSync(fd);
    } catch {
      /* fd already closed */
    }
    try {
      fs.unlinkSync(lockPath);
    } catch {
      /* lock already gone */
    }
  }

  // Every create/update/close mutation runs inside this single exclusive
  // section so reads and writes across the two stores are serializable; a close
  // can never race an update into archiving stale bytes.
  function withStoreLock(fn) {
    const fd = acquireLock();
    try {
      return fn();
    } finally {
      releaseLock(fd);
    }
  }

  function allocateParentId() {
    let max = 0;
    for (const kind of [TASKS_DIR, COMPLETED_DIR]) {
      for (const { identity } of listDir(kind)) {
        const parent = Number.parseInt(identity.id.split(".")[0], 10);
        if (Number.isInteger(parent) && parent > max) max = parent;
      }
    }
    return String(max + 1);
  }

  function idExists(id) {
    return [TASKS_DIR, COMPLETED_DIR].some((kind) =>
      listDir(kind).some((entry) => entry.identity.id === id)
    );
  }

  // --- atomic publication: temp on same fs, hard-link (no overwrite), unlink ---

  function publishNewFile(dir, fileName, content) {
    const dest = path.join(dir, fileName);
    assertWithin(dir, dest);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = tempPath(dir, path.basename(fileName));
    fs.writeFileSync(tmp, content);
    try {
      if (testHooks.beforePublish) testHooks.beforePublish(dest);
      fs.linkSync(tmp, dest);
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new LocalStoreError(`local task file already exists: ${fileName}`, { cause: error });
      }
      throw error;
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* temp already gone */
      }
    }
    return dest;
  }

  function replaceFileAtomic(dir, fileName, content) {
    const dest = path.join(dir, fileName);
    assertWithin(dir, dest);
    const tmp = tempPath(dir, path.basename(fileName));
    fs.writeFileSync(tmp, content);
    try {
      fs.renameSync(tmp, dest);
    } catch (error) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* temp already gone */
      }
      throw error;
    }
    return dest;
  }

  // --- rendered content builders ---

  function buildFilename(identity, title) {
    const slug = slugify(title) || identity.id;
    return `${identity.ref} - ${slug}.md`;
  }

  function buildNewContent({ identity, title, status, labels, priority, dependencies, body }) {
    const entries = [
      { key: "id", lines: [`id: ${identity.ref}`] },
      { key: "title", lines: renderFieldLines("title", title) },
      { key: "status", lines: renderFieldLines("status", status) },
      { key: "labels", lines: renderFieldLines("labels", labels) },
      { key: "priority", lines: renderFieldLines("priority", priority) },
    ];
    if (dependencies.length) entries.push({ key: "dependencies", lines: renderFieldLines("dependencies", dependencies) });
    entries.push({ key: "created_date", lines: [renderScalar("created_date", today())] });
    return `${stringifyFrontmatter(entries)}${normalizeBody(body)}`;
  }

  // --- the seven required operations ---

  function availability() {
    if (typeof backlogDir !== "string" || !backlogDir.trim()) {
      return { available: false, reason: "local tracker backlogDir is not configured" };
    }
    if (prefixIssue) {
      return { available: false, reason: `local tracker ${prefixIssue}` };
    }
    for (const probe of [backlogDir, dirPath(TASKS_DIR), dirPath(COMPLETED_DIR)]) {
      let stat;
      try {
        stat = fs.statSync(probe);
      } catch (error) {
        if (error.code === "ENOENT") continue; // created lazily on first write
        return { available: false, reason: `local store path ${probe} is unusable: ${error.message}` };
      }
      if (!stat.isDirectory()) {
        return { available: false, reason: `local store path ${probe} is not a directory` };
      }
    }
    return { available: true };
  }

  function capabilities() {
    return [];
  }

  function list({ state = "open" } = {}) {
    const kinds = state === "all"
      ? [TASKS_DIR, COMPLETED_DIR]
      : state === "closed"
        ? [COMPLETED_DIR]
        : [TASKS_DIR];
    const tasks = [];
    const seen = new Map();
    for (const kind of kinds) {
      for (const entry of listDir(kind)) {
        const prior = seen.get(entry.identity.id);
        if (prior && prior !== kind) {
          throw new LocalStoreError(
            `local task ${entry.identity.ref} exists in both active and completed stores; ` +
              "an exact id must be unique across the canonical stores"
          );
        }
        seen.set(entry.identity.id, kind);
        const task = readTask(kind, entry);
        if (task) tasks.push(task);
      }
    }
    return tasks.sort(compareByParentThenSub);
  }

  function read(selector) {
    const identity = resolveIdentity(selector);
    const { active, completed } = locateEntry(identity);
    const kind = active ? TASKS_DIR : COMPLETED_DIR;
    const entry = active || completed;
    if (!entry) throw new LocalStoreError(`local task not found: ${identity.ref}`);
    const task = readTask(kind, entry);
    if (!task) throw new LocalStoreError(`local task file for ${identity.ref} is malformed`);
    return task;
  }

  function create(input = {}) {
    rejectUnsupportedOptions("create", input, CREATE_OPTIONS);
    assertUsablePrefix();
    const title = input.title;
    if (typeof title !== "string" || !title.trim()) {
      throw new LocalStoreError("local task creation requires a non-empty title");
    }
    let requestedId = null;
    if (input.id !== undefined && input.id !== null) {
      const parsed = parseTaskRef(`${taskPrefix}-${input.id}`, refOptions);
      if (!parsed) throw new LocalStoreError(`invalid explicit local task id: ${String(input.id)}`);
      requestedId = parsed.id;
    }

    return withStoreLock(() => {
      const id = requestedId ?? allocateParentId();
      if (idExists(id)) {
        throw new LocalStoreError(`local task ${taskPrefix}-${id} already exists`);
      }
      const identity = parseTaskRef(`${taskPrefix}-${id}`, refOptions);
      const body = input.body !== undefined ? String(input.body) : "\n## Description\n(No description provided)\n";
      const content = buildNewContent({
        identity,
        title,
        status: input.status ? String(input.status) : defaultStatus,
        labels: Array.isArray(input.labels) ? input.labels : [],
        priority: input.priority ? String(input.priority) : "medium",
        dependencies: Array.isArray(input.dependencies) ? input.dependencies : [],
        body,
      });
      publishNewFile(dirPath(TASKS_DIR), buildFilename(identity, title), content);
      return { tracker: "local", id: identity.id, ref: identity.ref };
    });
  }

  const NEUTRAL_FIELDS = ["title", "status", "priority"];
  const NEUTRAL_LIST_FIELDS = ["labels", "dependencies"];

  function update(selector, changes = {}) {
    rejectUnsupportedOptions("update", changes, UPDATE_OPTIONS);
    assertUsablePrefix();
    const identity = resolveIdentity(selector);

    return withStoreLock(() => {
      const { active: entry } = locateEntry(identity);
      if (!entry) {
        throw new LocalStoreError(`no active local task to update: ${identity.ref}`);
      }
      const full = path.join(dirPath(TASKS_DIR), entry.file);
      const content = fs.readFileSync(full, "utf-8");
      const split = splitDocument(content);
      if (!split) throw new LocalStoreError(`local task file for ${identity.ref} is malformed`);

      const fieldChanges = {};
      for (const field of NEUTRAL_FIELDS) {
        if (changes[field] !== undefined) fieldChanges[field] = String(changes[field]);
      }
      for (const field of NEUTRAL_LIST_FIELDS) {
        if (changes[field] !== undefined) {
          if (!Array.isArray(changes[field])) {
            throw new LocalStoreError(`local update ${field} must be an array`);
          }
          fieldChanges[field] = changes[field].map(String);
        }
      }
      if (changes.updated_date !== undefined) fieldChanges.updated_date = String(changes.updated_date);

      const entries = applyFrontmatterChanges(parseFrontmatterEntries(split.frontmatter), fieldChanges);
      const body = changes.body !== undefined ? normalizeBody(String(changes.body)) : split.body;
      const nextContent = `${stringifyFrontmatter(entries)}${body}`;
      replaceFileAtomic(dirPath(TASKS_DIR), entry.file, nextContent);
      return { tracker: "local", id: identity.id, ref: identity.ref };
    });
  }

  function close(selector, options = {}) {
    rejectUnsupportedOptions("close", options, CLOSE_OPTIONS);
    assertUsablePrefix();
    const identity = resolveIdentity(selector);

    return withStoreLock(() => {
      // locateEntry rejects the store-wide exact-id collision (active + a
      // completed twin under a different slug) before any bytes are touched, so
      // close can never publish a second completed twin over a duplicate id.
      const { active: activeEntry, completed: completedEntry } = locateEntry(identity);
      if (!activeEntry) {
        if (completedEntry) {
          return { tracker: "local", id: identity.id, ref: identity.ref };
        }
        throw new LocalStoreError(`local task not found: ${identity.ref}`);
      }

      const src = path.join(dirPath(TASKS_DIR), activeEntry.file);
      const content = fs.readFileSync(src, "utf-8");
      const split = splitDocument(content);
      if (!split) throw new LocalStoreError(`local task file for ${identity.ref} is malformed`);

      const entries = applyFrontmatterChanges(parseFrontmatterEntries(split.frontmatter), {
        status: DONE_STATUS,
      });
      const doneContent = `${stringifyFrontmatter(entries)}${split.body}`;
      publishNewFile(dirPath(COMPLETED_DIR), activeEntry.file, doneContent);
      fs.unlinkSync(src);
      return { tracker: "local", id: identity.id, ref: identity.ref };
    });
  }

  return Object.freeze({ availability, capabilities, list, read, create, update, close });
}

function compareByParentThenSub(left, right) {
  const [lp, ls = -1] = left.id.split(".").map(Number);
  const [rp, rs = -1] = right.id.split(".").map(Number);
  return lp === rp ? ls - rs : lp - rp;
}

module.exports = {
  createLocalAdapter,
  LocalStoreError,
};
