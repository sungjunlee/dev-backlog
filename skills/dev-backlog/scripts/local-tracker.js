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

// The only accepted list scopes. Any other `state` fails closed rather than
// silently narrowing to the open store.
const LIST_STATE_KINDS = Object.freeze({
  open: [TASKS_DIR],
  closed: [COMPLETED_DIR],
  all: [TASKS_DIR, COMPLETED_DIR],
});
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

// --- required-field and injection validation (fail closed) ---

const REQUIRED_FRONTMATTER_KEYS = ["id", "title", "status"];
const NEUTRAL_FIELDS = ["title", "status", "priority"];
const NEUTRAL_LIST_FIELDS = ["labels", "dependencies"];

// Control characters (the C0 set plus DEL) cannot survive the simple YAML
// renderer: a raw newline in a scalar or list item re-parses as a fresh `key:`
// line and injects arbitrary frontmatter. Reject them before any mutation.
const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/;

function assertNoControlChars(field, value) {
  if (CONTROL_CHAR_RE.test(value)) {
    throw new LocalStoreError(
      `local ${field} must not contain newlines or control characters; ` +
        "they would inject frontmatter keys and break the task round trip"
    );
  }
}

function cleanScalar(field, value) {
  const text = String(value);
  assertNoControlChars(field, text);
  return text;
}

/**
 * Require exactly one non-empty scalar `id`, `title`, and `status`, with the id
 * equal to the filename ref. Runs before every list/read/update/close so
 * missing, duplicate, wrong-typed, or empty required fields fail closed rather
 * than flowing into a normalized task or a mutation.
 */
function requireValidFrontmatter(entries, ref) {
  for (const key of REQUIRED_FRONTMATTER_KEYS) {
    const matches = entries.filter((entry) => entry.key === key);
    if (matches.length !== 1) {
      const problem = matches.length === 0 ? "missing" : "duplicate";
      throw new LocalStoreError(`local task ${ref} is malformed: ${problem} required '${key}' frontmatter`);
    }
    const value = entryValue(matches[0]);
    // Arrays and mappings both report as objects; a required field must be scalar.
    if (value !== null && typeof value === "object") {
      throw new LocalStoreError(`local task ${ref} is malformed: '${key}' must be a single scalar value`);
    }
    const text = value === undefined || value === null ? "" : String(value).trim();
    if (!text) {
      throw new LocalStoreError(`local task ${ref} is malformed: '${key}' must be a non-empty scalar`);
    }
    if (key === "id" && String(value) !== ref) {
      throw new LocalStoreError(
        `local task ${ref} is corrupt: frontmatter id ${JSON.stringify(String(value))} does not match its filename`
      );
    }
  }
}

function buildUpdateFieldChanges(changes) {
  const fieldChanges = {};
  for (const field of NEUTRAL_FIELDS) {
    if (changes[field] !== undefined) fieldChanges[field] = cleanScalar(field, changes[field]);
  }
  for (const field of NEUTRAL_LIST_FIELDS) {
    if (changes[field] === undefined) continue;
    if (!Array.isArray(changes[field])) {
      throw new LocalStoreError(`local update ${field} must be an array`);
    }
    fieldChanges[field] = changes[field].map((item) => cleanScalar(`${field} item`, item));
  }
  if (changes.updated_date !== undefined) {
    fieldChanges.updated_date = cleanScalar("updated_date", changes.updated_date);
  }
  return fieldChanges;
}

// --- close compensation: identity-checked rollback of a published copy ---

function fileIdentity(target) {
  const stat = fs.statSync(target);
  return { dev: stat.dev, ino: stat.ino };
}

function sameFileIdentity(a, b) {
  return a.dev === b.dev && a.ino === b.ino;
}

function closeSourceRetained(identity, src, cause) {
  return new LocalStoreError(
    `local close of ${identity.ref} could not remove the active source ${src}, so the ` +
      "completed copy was rolled back; the task is unchanged and still open. " +
      `Retry once the source is writable. Cause: ${cause.message}`,
    { cause }
  );
}

function closeSplitStore(identity, src, dest, unlinkError, rollbackError) {
  const note = rollbackError
    ? `rolling the completed copy back also failed (${rollbackError.message})`
    : "the completed copy was replaced by another writer and was left untouched";
  return new LocalStoreError(
    `local close of ${identity.ref} could not remove the active source ${src} ` +
      `(${unlinkError.message}) and ${note}; both ${src} and ${dest} remain. ` +
      "Resolve the duplicate manually before continuing.",
    { cause: unlinkError }
  );
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
    if (!split) {
      throw new LocalStoreError(
        `local task ${entry.identity.ref} is malformed: missing Backlog.md frontmatter`
      );
    }
    const entries = parseFrontmatterEntries(split.frontmatter);
    requireValidFrontmatter(entries, entry.identity.ref);
    const object = frontmatterObject(entries);
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

  // After the completed copy is published, remove the active source to finish the
  // move. A failed unlink means both stores momentarily claim the id, so roll the
  // publication back — leaving the active source as the single authoritative task.
  function retireSourceAfterPublish(identity, src, dest) {
    const published = fileIdentity(dest);
    try {
      if (testHooks.beforeUnlinkSource) testHooks.beforeUnlinkSource(src);
      fs.unlinkSync(src);
    } catch (unlinkError) {
      rollbackPublishedCopy(identity, src, dest, published, unlinkError);
    }
  }

  // Undo exactly the copy this close created. Re-stat the destination first: if
  // it vanished the source already survives alone; if its inode no longer matches
  // our publication an external writer replaced it and we must not erase it.
  function rollbackPublishedCopy(identity, src, dest, published, unlinkError) {
    let live;
    try {
      live = fileIdentity(dest);
    } catch (statError) {
      if (statError.code === "ENOENT") throw closeSourceRetained(identity, src, unlinkError);
      throw closeSplitStore(identity, src, dest, unlinkError, statError);
    }
    if (!sameFileIdentity(live, published)) {
      throw closeSplitStore(identity, src, dest, unlinkError, null);
    }
    try {
      if (testHooks.beforeRollback) testHooks.beforeRollback(dest);
      fs.unlinkSync(dest);
    } catch (rollbackError) {
      throw closeSplitStore(identity, src, dest, unlinkError, rollbackError);
    }
    throw closeSourceRetained(identity, src, unlinkError);
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
    if (!Object.prototype.hasOwnProperty.call(LIST_STATE_KINDS, state)) {
      throw new LocalStoreError(
        `invalid local list state ${JSON.stringify(state)}; expected one of open, closed, all`
      );
    }
    const kinds = LIST_STATE_KINDS[state];
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
        tasks.push(readTask(kind, entry));
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
    return readTask(kind, entry);
  }

  function create(input = {}) {
    rejectUnsupportedOptions("create", input, CREATE_OPTIONS);
    assertUsablePrefix();
    const title = input.title;
    if (typeof title !== "string" || !title.trim()) {
      throw new LocalStoreError("local task creation requires a non-empty title");
    }
    // Reject injection before the lock so no mkdir/temp/mtime mutation occurs.
    assertNoControlChars("title", title);
    if (input.status != null) assertNoControlChars("status", String(input.status));
    if (input.priority != null) assertNoControlChars("priority", String(input.priority));
    for (const field of NEUTRAL_LIST_FIELDS) {
      if (Array.isArray(input[field])) {
        for (const item of input[field]) assertNoControlChars(`${field} item`, String(item));
      }
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

  function update(selector, changes = {}) {
    rejectUnsupportedOptions("update", changes, UPDATE_OPTIONS);
    assertUsablePrefix();
    const identity = resolveIdentity(selector);
    // Validate and coerce every field before the lock so a rejected injection or
    // wrong-typed list never triggers an mkdir/lock/temp/mtime mutation.
    const fieldChanges = buildUpdateFieldChanges(changes);

    return withStoreLock(() => {
      const { active: entry } = locateEntry(identity);
      if (!entry) {
        throw new LocalStoreError(`no active local task to update: ${identity.ref}`);
      }
      const full = path.join(dirPath(TASKS_DIR), entry.file);
      const content = fs.readFileSync(full, "utf-8");
      const split = splitDocument(content);
      if (!split) throw new LocalStoreError(`local task file for ${identity.ref} is malformed`);
      const currentEntries = parseFrontmatterEntries(split.frontmatter);
      requireValidFrontmatter(currentEntries, identity.ref);

      const entries = applyFrontmatterChanges(currentEntries, fieldChanges);
      const body = changes.body !== undefined ? normalizeBody(String(changes.body)) : split.body;
      const nextContent = `${stringifyFrontmatter(entries)}${body}`;
      // A change-free update (or one that resolves to identical bytes) must not
      // rewrite the file, so the mtime and inode stay stable.
      if (nextContent !== content) {
        replaceFileAtomic(dirPath(TASKS_DIR), entry.file, nextContent);
      }
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
      const currentEntries = parseFrontmatterEntries(split.frontmatter);
      requireValidFrontmatter(currentEntries, identity.ref);

      const entries = applyFrontmatterChanges(currentEntries, { status: DONE_STATUS });
      const doneContent = `${stringifyFrontmatter(entries)}${split.body}`;
      const dest = publishNewFile(dirPath(COMPLETED_DIR), activeEntry.file, doneContent);
      retireSourceAfterPublish(identity, src, dest);
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
