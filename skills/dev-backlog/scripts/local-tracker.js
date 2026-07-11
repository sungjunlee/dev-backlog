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
// Durable intent journal for close: written after the completed copy lands and
// before the active source is removed, so a process that dies in that window is
// finished (or discarded) on the next open instead of leaving two authorities.
const CLOSE_MARKER_FILE = ".local-tracker.close";
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

// --- lock stamp inspection (crash detection, no reclamation) ---

// The lock file stamps `${pid}:${token}`: the pid lets a later process tell a
// crashed holder from a live one, while the token is a per-acquisition nonce so
// release can bind its unlink to the exact file instance it created. Reclamation
// is intentionally NOT automatic: a path-based rename/unlink cannot reclaim a
// stale lock without racing a replacement holder, so a dead-PID lock is surfaced
// as an actionable manual-cleanup error and left untouched.
function readLockStamp(lockPath) {
  // The lock must be a regular, non-symlink file; never follow a symlink planted
  // at the lock path when judging ownership.
  const stat = lstatSafe(lockPath);
  if (!stat || !stat.isFile()) return null;
  let raw;
  try {
    raw = fs.readFileSync(lockPath, "utf-8").trim();
  } catch {
    return null;
  }
  const colon = raw.indexOf(":");
  const pid = Number.parseInt(colon === -1 ? raw : raw.slice(0, colon), 10);
  if (!(Number.isInteger(pid) && pid > 0)) return null;
  return { pid, token: colon === -1 ? "" : raw.slice(colon + 1) };
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM"; // exists but not signalable by us
  }
}

// --- frontmatter / body split, preserving human bytes verbatim ---

const FRONTMATTER_RE = /^---(\r?\n)([\s\S]*?)\r?\n---(\r?\n[\s\S]*|$)/;

function splitDocument(content) {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;
  // `eol` is the stored newline style, taken from the opening fence. The
  // frontmatter is normalized to LF so value parsing sees clean logical lines
  // (a trailing CR would otherwise make `id` read back as missing), while `eol`
  // lets re-emission restore the original CRLF byte-for-byte. The body is kept
  // verbatim so its own newline style is never rewritten.
  const eol = match[1];
  const frontmatter = match[2].replace(/\r\n/g, "\n");
  return { frontmatter, body: match[3], eol };
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

// A block-sequence item is left bare only when it is unambiguously a plain
// string. Anything else — indicators (`#`, `[`, `{`, `-`, …), a mapping colon,
// leading/trailing space, an empty value, or a token a YAML tool would resolve
// to a boolean/null/number — is single-quoted so it round-trips as the exact
// string it was given and never changes meaning for Backlog.md or any reader.
const SAFE_PLAIN_ITEM_RE = /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/;
const YAML_RESERVED_RE = /^(?:true|false|yes|no|on|off|null|none|~)$/i;
const NUMBERLIKE_RE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

function encodeListItem(value) {
  const text = String(value);
  if (SAFE_PLAIN_ITEM_RE.test(text) && !YAML_RESERVED_RE.test(text) && !NUMBERLIKE_RE.test(text)) {
    return text;
  }
  return `'${text.replace(/'/g, "''")}'`;
}

function renderFieldLines(key, value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${key}: []`];
    return [`${key}:`, ...value.map((item) => `  - ${encodeListItem(item)}`)];
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

function stringifyFrontmatter(entries, eol = "\n") {
  const inner = entries.flatMap((entry) => entry.lines).join(eol);
  return `---${eol}${inner}${eol}---`;
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

// --- filesystem-boundary guards ---

function contentHash(content) {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
}

function lstatSafe(target) {
  try {
    return fs.lstatSync(target);
  } catch {
    return null;
  }
}

// A canonical task must be a real file. A symlinked task file would let a read
// or close follow the link and touch bytes outside the backlog, so reject any
// non-regular file (symlink, directory, socket) before it is read or archived.
function assertRegularFile(full, ref) {
  const stat = lstatSafe(full);
  if (!stat) {
    throw new LocalStoreError(`cannot access local task ${ref}: file is missing or unreadable`);
  }
  if (!stat.isFile()) {
    throw new LocalStoreError(`local task ${ref} is not a regular file; symlinked task files are refused`);
  }
}

/** True only when `dest`'s resolved parent is exactly `dir` (no traversal). */
function withinDir(dir, dest) {
  return path.resolve(path.dirname(dest)) === path.resolve(dir);
}

// A canonical store directory is sound only when the path is absent (created
// lazily on first write) or a real, non-symlink directory. A symlink or plain
// file here would let a lifecycle operation read or write outside the backlog,
// so it is refused. Returns an actionable reason, or null when the path is safe.
function realDirIssue(dir) {
  let stat;
  try {
    // lstat, not stat: a symlinked directory must be refused, not resolved.
    stat = fs.lstatSync(dir);
  } catch (error) {
    if (error.code === "ENOENT") return null; // created lazily on first write
    return `local store path ${dir} is unusable: ${error.message}`;
  }
  if (stat.isSymbolicLink()) return `local store path ${dir} must not be a symlink`;
  if (!stat.isDirectory()) return `local store path ${dir} is not a directory`;
  return null;
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
    if (!withinDir(dir, dest)) {
      throw new LocalStoreError(
        `refusing to write a local task outside its canonical directory: ${dest}`
      );
    }
  }

  // Report the first canonical directory (backlog root, tasks/, completed/) that
  // is not a real non-symlink directory. Powers both the structured availability
  // probe and the per-operation integrity guards below.
  function canonicalDirIssue() {
    for (const probe of [backlogDir, dirPath(TASKS_DIR), dirPath(COMPLETED_DIR)]) {
      const issue = realDirIssue(probe);
      if (issue) return issue;
    }
    return null;
  }

  // Enforce canonical-directory integrity at every lifecycle boundary — not just
  // in availability(). Called at the entry of list/read/create/update/close and
  // again under the store lock, so a directory swapped for a symlink or a plain
  // file after the initial probe can never route a read or write outside the
  // backlog. Absent directories are allowed (create materializes them).
  function assertCanonicalDirs() {
    const issue = canonicalDirIssue();
    if (issue) throw new LocalStoreError(issue);
  }

  // The tightest boundary check: a single directory must be absent or a real
  // non-symlink directory immediately before we mkdir/link/rename into it.
  function assertRealDir(dir) {
    const issue = realDirIssue(dir);
    if (issue) throw new LocalStoreError(issue);
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
    assertRegularFile(full, entry.identity.ref);
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
    assertRealDir(backlogDir); // never create the lock through a symlinked root
    fs.mkdirSync(backlogDir, { recursive: true });
    const lockPath = path.join(backlogDir, LOCK_FILE);
    const token = crypto.randomBytes(12).toString("hex");
    for (let attempt = 0; attempt <= lockConfig.retries; attempt += 1) {
      try {
        const fd = fs.openSync(lockPath, "wx");
        // Stamp `${pid}:${token}` so a later process can tell a crashed holder
        // from a live one (pid) and bind release to this exact lock instance
        // (token + file identity) rather than to the path alone.
        try {
          fs.writeSync(fd, `${process.pid}:${token}`);
        } catch {
          /* the lock is held regardless of whether the stamp lands */
        }
        return { fd, token };
      } catch (error) {
        if (error.code !== "EEXIST") {
          throw new LocalStoreError(`cannot acquire local allocation lock: ${error.message}`, { cause: error });
        }
        if (attempt < lockConfig.retries) sleepSync(lockConfig.delayMs);
      }
    }
    // Exhausted: never reclaim automatically. A path-based rename/unlink cannot
    // evict a stale lock without racing a replacement holder, so a dead-PID lock
    // is surfaced as an actionable manual-cleanup error and left untouched.
    throw lockContentionError(path.join(backlogDir, LOCK_FILE));
  }

  // Distinguish a provably-dead holder (stale lock, needs manual cleanup) from
  // live contention. Neither case touches the lock: reclamation is deliberately
  // manual because there is no race-free path-based way to reclaim it.
  function lockContentionError(lockPath) {
    const stamp = readLockStamp(lockPath);
    if (stamp && !processAlive(stamp.pid)) {
      return new LocalStoreError(
        `the local allocation lock ${lockPath} is held by pid ${stamp.pid}, which is no longer ` +
          "running (stale lock). It is not reclaimed automatically because a path-based reclaim " +
          "cannot avoid racing a replacement holder. After confirming no allocator is running, " +
          "remove the lock file manually to proceed."
      );
    }
    return new LocalStoreError(
      `another local allocation holds the store lock ${lockPath}; retry once it releases ` +
        "(remove it manually only if you are certain no allocator is running)."
    );
  }

  function releaseLock(handle) {
    const lockPath = path.join(backlogDir, LOCK_FILE);
    if (testHooks.beforeReleaseLock) testHooks.beforeReleaseLock(lockPath);
    // Bind release to BOTH the token we stamped and the exact file instance we
    // opened. Our fd keeps pointing at the file we created even after the path is
    // unlinked or replaced, so comparing the fd's identity to whatever now sits
    // at the path reveals a replacement owner. If ownership or file identity
    // changed, preserve the replacement and fail clearly rather than evict a live
    // holder — a normal release only removes the lock still proven to be ours.
    let held = null;
    try {
      held = fs.fstatSync(handle.fd);
    } catch {
      /* fd already invalid */
    }
    const atPath = lstatSafe(lockPath);
    const stamp = readLockStamp(lockPath);
    try {
      fs.closeSync(handle.fd);
    } catch {
      /* fd already closed */
    }
    if (atPath === null) return; // lock already gone: nothing of ours to release
    // File identity is definitive while our fd is open: the inode we created
    // cannot be recycled under the path, so a matching dev/ino proves it is our
    // instance. The token is the second binding — a present stamp must be ours
    // (it catches an inode-number reuse after our fd closes), but a stamp lost to
    // a failed write does not veto an identity we can still prove by the fd.
    const identityMatch =
      held !== null &&
      atPath.isFile() &&
      atPath.dev === held.dev &&
      atPath.ino === held.ino;
    const tokenOk = stamp === null || stamp.token === handle.token;
    const stillOurs = identityMatch && tokenOk;
    if (!stillOurs) {
      throw new LocalStoreError(
        `local allocation lock ${lockPath} changed owner before release and was left ` +
          "untouched to protect the replacement holder; a concurrent allocator may be running. " +
          "Resolve the contention and remove the lock manually only if you are certain none is."
      );
    }
    try {
      fs.unlinkSync(lockPath);
    } catch {
      /* lock already gone */
    }
  }

  // --- crash-recoverable close journal ---

  function closeMarkerPath() {
    return path.join(backlogDir, CLOSE_MARKER_FILE);
  }

  function writeCloseMarker(marker) {
    const fd = fs.openSync(closeMarkerPath(), "w");
    try {
      fs.writeSync(fd, JSON.stringify(marker));
      fs.fsyncSync(fd); // durable so the intent survives a power loss / crash
    } finally {
      fs.closeSync(fd);
    }
  }

  function removeCloseMarker() {
    try {
      fs.unlinkSync(closeMarkerPath());
    } catch {
      /* already gone */
    }
  }

  // The close journal is untrusted data. Accept only a marker whose filename is
  // a safe basename that parses back to the journaled identity; a malformed or
  // mismatched marker returns null so recovery fails closed instead of acting on
  // an attacker-controlled path. Absolute src/dest strings are never trusted —
  // the paths are reconstructed from the validated relative filename below.
  function validateCloseMarker(marker) {
    if (!marker || typeof marker !== "object") return null;
    if (marker.v !== 1 || marker.phase !== "publish") return null;
    const { id, ref, file, destHash } = marker;
    if (typeof id !== "string" || typeof ref !== "string") return null;
    if (typeof file !== "string" || typeof destHash !== "string") return null;
    if (!/^[0-9a-f]{64}$/.test(destHash)) return null;
    if (file !== path.basename(file) || /[\\/]/.test(file)) return null;
    const parsed = parseTaskFileName(file, { taskPrefix, tracker: "local" });
    if (!parsed || parsed.id !== id || parsed.ref !== ref) return null;
    return { id, ref, file, destHash };
  }

  // Read a canonical file's frontmatter id and content hash without following a
  // symlink. Returns null for anything that is not a regular file, so a
  // symlinked src/dest can never be promoted or deleted by recovery.
  function readIdentityAndHash(target) {
    const stat = lstatSafe(target);
    if (!stat || !stat.isFile()) return null;
    let content;
    try {
      content = fs.readFileSync(target, "utf-8");
    } catch {
      return null;
    }
    const split = splitDocument(content);
    let id = null;
    if (split) {
      const idEntry = parseFrontmatterEntries(split.frontmatter).find((entry) => entry.key === "id");
      if (idEntry) id = String(entryValue(idEntry));
    }
    return { id, hash: contentHash(content) };
  }

  // The destination is this close's publication only if it is a regular file
  // whose exact bytes (content evidence) and frontmatter id (identity evidence)
  // match the journaled intent — never an external or partially written file.
  function publishedMatches(dest, ref, destHash) {
    const info = readIdentityAndHash(dest);
    return !!info && info.hash === destHash && info.id === ref;
  }

  // Independently recompute the exact Done bytes a faithful close of the active
  // source would publish, so roll-forward is verified against the real
  // authoritative content instead of the untrusted marker hash. The source is
  // fully validated first (regular file, well-formed frontmatter, id === ref);
  // returns the derived bytes and their hash, or null when it cannot be derived.
  function deriveExpectedDone(src, ref) {
    const stat = lstatSafe(src);
    if (!stat || !stat.isFile()) return null;
    let content;
    try {
      content = fs.readFileSync(src, "utf-8");
    } catch {
      return null;
    }
    const split = splitDocument(content);
    if (!split) return null;
    const entries = parseFrontmatterEntries(split.frontmatter);
    try {
      requireValidFrontmatter(entries, ref);
    } catch {
      return null; // an unvalidatable source is not authoritative to derive from
    }
    const doneEntries = applyFrontmatterChanges(entries, { status: DONE_STATUS });
    const doneContent = `${stringifyFrontmatter(doneEntries, split.eol)}${split.body}`;
    return { content: doneContent, hash: contentHash(doneContent) };
  }

  // Finish or discard a close a previous process left half-applied. MUST run
  // under the store lock. The journal records only the intent to publish; every
  // field — including destHash — is untrusted. Recovery derives the exact Done
  // bytes independently from the fully validated active source and rolls the move
  // forward ONLY when the derived hash, the journaled hash, and the destination's
  // actual bytes+id ALL agree:
  //   - all three agree -> the destination is a faithful publication of this
  //     source; retire the active source (roll the move forward).
  //   - any disagreement (including a valid, self-consistent marker/destination
  //     pair whose bytes differ from the active body) -> roll-forward is refused
  //     and every file is preserved (fail closed). A surviving duplicate then
  //     fails closed on the next read/list via the exact-id guard.
  // Nothing outside the canonical stores, and nothing whose derived identity we
  // cannot confirm, is ever deleted or promoted; the spent marker is then cleared.
  function recover() {
    const markerPath = closeMarkerPath();
    const markerStat = lstatSafe(markerPath);
    if (markerStat === null) return; // no interrupted close to reconcile
    if (!markerStat.isFile()) {
      removeCloseMarker(); // a symlink/dir at the marker path is untrusted
      return;
    }
    let raw;
    try {
      raw = fs.readFileSync(markerPath, "utf-8");
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw new LocalStoreError(`cannot read local recovery marker: ${error.message}`, { cause: error });
    }
    let marker;
    try {
      marker = JSON.parse(raw);
    } catch {
      removeCloseMarker(); // an unreadable marker cannot be acted on
      return;
    }
    const plan = validateCloseMarker(marker);
    if (!plan) {
      removeCloseMarker(); // malformed/untrusted marker: fail closed, touch nothing
      return;
    }
    const src = path.join(dirPath(TASKS_DIR), plan.file);
    const dest = path.join(dirPath(COMPLETED_DIR), plan.file);
    // Containment: the reconstructed paths must resolve exactly into their
    // canonical directories (validation guarantees this; verify defensively).
    if (!withinDir(dirPath(TASKS_DIR), src) || !withinDir(dirPath(COMPLETED_DIR), dest)) {
      removeCloseMarker();
      return;
    }
    // Derive the expected Done bytes from the active source itself, then require
    // derived === journaled === destination (bytes and id). A marker that merely
    // matches the destination is not enough: without this the destination could
    // be self-consistent completed bytes for the same ref that were never the
    // publication of THIS active body, and rolling forward would delete
    // authoritative content.
    const derived = deriveExpectedDone(src, plan.ref);
    const rollForward =
      derived !== null &&
      derived.hash === plan.destHash &&
      publishedMatches(dest, plan.ref, derived.hash);
    if (rollForward) {
      try {
        fs.unlinkSync(src);
      } catch {
        return; // roll-forward proven but the source is not yet writable; retry later
      }
    }
    // Proven-and-completed, or refused-and-every-file-preserved: the untrusted
    // intent is spent either way, so clear it. A refused roll-forward leaves the
    // active source intact and any duplicate to the exact-id guard.
    removeCloseMarker();
  }

  // Every create/update/close mutation runs inside this single exclusive
  // section so reads and writes across the two stores are serializable; a close
  // can never race an update into archiving stale bytes. Recovery runs first so
  // any interrupted close is healed before the next mutation observes the store.
  // Recovery never runs on the read paths (list/read), which stay non-mutating.
  function withStoreLock(fn) {
    const handle = acquireLock();
    try {
      // Re-verify canonical-directory integrity under the lock (the mutation
      // boundary) so a directory swapped for a symlink between the entry probe and
      // now cannot route recovery or the mutation outside the backlog.
      assertCanonicalDirs();
      recover();
      return fn();
    } finally {
      releaseLock(handle);
    }
  }

  function allocateParentId() {
    // Compare and increment as BigInt so an existing parent beyond
    // Number.MAX_SAFE_INTEGER (e.g. BACK-9007199254740993) is not silently
    // rounded down, which would allocate a colliding/backwards id.
    let max = 0n;
    for (const kind of [TASKS_DIR, COMPLETED_DIR]) {
      for (const { identity } of listDir(kind)) {
        const parent = BigInt(identity.id.split(".")[0]);
        if (parent > max) max = parent;
      }
    }
    return String(max + 1n);
  }

  function idExists(id) {
    return [TASKS_DIR, COMPLETED_DIR].some((kind) =>
      listDir(kind).some((entry) => entry.identity.id === id)
    );
  }

  // --- atomic publication: temp on same fs, hard-link (no overwrite), unlink ---

  // Route temp writes through an injectable writer so a test can reproduce a
  // partial-write ENOSPC that leaves bytes on disk. The `wx` flag makes the temp
  // a fresh regular file: a symlink (or any entry) pre-planted at the temp path
  // fails the create instead of being followed or overwritten.
  function writeTemp(tmp, content) {
    if (testHooks.writeFile) return testHooks.writeFile(tmp, content);
    return fs.writeFileSync(tmp, content, { flag: "wx" });
  }

  function publishNewFile(dir, fileName, content) {
    const dest = path.join(dir, fileName);
    assertWithin(dir, dest);
    assertRealDir(dir); // final boundary: never link into a symlinked target dir
    fs.mkdirSync(dir, { recursive: true });
    const tmp = tempPath(dir, path.basename(fileName));
    // The temp write is inside the try so a partial write (e.g. ENOSPC) is
    // cleaned by the finally instead of leaking a stray `.tmp`.
    try {
      writeTemp(tmp, content);
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
        /* temp already gone or never created */
      }
    }
    return dest;
  }

  function replaceFileAtomic(dir, fileName, content) {
    const dest = path.join(dir, fileName);
    assertWithin(dir, dest);
    assertRealDir(dir); // final boundary: never rename into a symlinked target dir
    const tmp = tempPath(dir, path.basename(fileName));
    // A successful rename consumes the temp; any earlier failure (partial write
    // or failed rename) is cleaned here so no stray `.tmp` survives.
    try {
      writeTemp(tmp, content);
      fs.renameSync(tmp, dest);
    } catch (error) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* temp already gone or never created */
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
    // The same canonical-directory integrity the lifecycle operations enforce on
    // every call: a symlinked or non-directory backlog root, tasks/, or completed/
    // is refused (an absent one is created lazily on first write).
    const issue = canonicalDirIssue();
    if (issue) return { available: false, reason: issue };
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
    assertCanonicalDirs(); // refuse a symlinked/foreign store before reading it
    // list never mutates: an interrupted close is healed on the next mutation,
    // not here. Duplicate copies from a crash surface as a fail-closed error.
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
    assertCanonicalDirs(); // refuse a symlinked/foreign store before reading it
    const identity = resolveIdentity(selector);
    // read never mutates; recovery of an interrupted close is deferred to the
    // next create/update/close under the store lock.
    const { active, completed } = locateEntry(identity);
    const kind = active ? TASKS_DIR : COMPLETED_DIR;
    const entry = active || completed;
    if (!entry) throw new LocalStoreError(`local task not found: ${identity.ref}`);
    return readTask(kind, entry);
  }

  function create(input = {}) {
    rejectUnsupportedOptions("create", input, CREATE_OPTIONS);
    assertUsablePrefix();
    assertCanonicalDirs(); // refuse a symlinked/foreign store before any mutation
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
    assertCanonicalDirs(); // refuse a symlinked/foreign store before any mutation
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
      assertRegularFile(full, identity.ref);
      const content = fs.readFileSync(full, "utf-8");
      const split = splitDocument(content);
      if (!split) throw new LocalStoreError(`local task file for ${identity.ref} is malformed`);
      const currentEntries = parseFrontmatterEntries(split.frontmatter);
      requireValidFrontmatter(currentEntries, identity.ref);

      const entries = applyFrontmatterChanges(currentEntries, fieldChanges);
      const body = changes.body !== undefined ? normalizeBody(String(changes.body)) : split.body;
      const nextContent = `${stringifyFrontmatter(entries, split.eol)}${body}`;
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
    assertCanonicalDirs(); // refuse a symlinked/foreign store before any mutation
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
      assertRegularFile(src, identity.ref);
      const content = fs.readFileSync(src, "utf-8");
      const split = splitDocument(content);
      if (!split) throw new LocalStoreError(`local task file for ${identity.ref} is malformed`);
      const currentEntries = parseFrontmatterEntries(split.frontmatter);
      requireValidFrontmatter(currentEntries, identity.ref);

      const entries = applyFrontmatterChanges(currentEntries, { status: DONE_STATUS });
      const doneContent = `${stringifyFrontmatter(entries, split.eol)}${split.body}`;
      const dest = path.join(dirPath(COMPLETED_DIR), activeEntry.file);
      // Journal only the validated relative identity/filename plus the exact
      // bytes we intend to publish (destHash). A crash anywhere between here and
      // the source unlink is reconciled to a single authority on the next
      // mutation: recovery reconstructs src/dest inside the canonical dirs and
      // rolls forward only when the destination proves it is this publication —
      // never a raw path taken from the marker.
      writeCloseMarker({
        v: 1,
        phase: "publish",
        id: identity.id,
        ref: identity.ref,
        file: activeEntry.file,
        destHash: contentHash(doneContent),
      });
      try {
        publishNewFile(dirPath(COMPLETED_DIR), activeEntry.file, doneContent);
        retireSourceAfterPublish(identity, src, dest);
      } catch (error) {
        removeCloseMarker();
        throw error;
      }
      removeCloseMarker();
      return { tracker: "local", id: identity.id, ref: identity.ref };
    });
  }

  return Object.freeze({ availability, capabilities, list, read, create, update, close });
}

function compareByParentThenSub(left, right) {
  // BigInt keys so large ids (past Number's safe range) still order correctly;
  // a bare parent sorts before its decimal subtasks via the -1 sentinel.
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

module.exports = {
  createLocalAdapter,
  LocalStoreError,
};
