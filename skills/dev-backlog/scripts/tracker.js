/**
 * Configured tracker boundary.
 *
 * Selection is configuration-only. Availability can reject the configured
 * adapter, but it can never choose a different one.
 */

const { createGithubAdapter } = require("./github-tracker.js");
const { createLocalAdapter } = require("./local-tracker.js");
const path = require("path");
const { configDisplayPath } = require("./portable-path.js");

const TRACKER_KEYS = Object.freeze(["github", "local"]);
const REQUIRED_ADAPTER_OPERATIONS = Object.freeze([
  "availability",
  "capabilities",
  "list",
  "read",
  "create",
  "update",
  "close",
]);
const CAPABILITY_NAMES = Object.freeze([
  "milestones",
  "pull-request-relationships",
  "mirrors",
  "progress-issues",
  "comments",
  "closing-semantics",
]);
const UNSUPPORTED_CAPABILITY_CODE = "TRACKER_CAPABILITY_UNSUPPORTED";

const DEFAULT_BACKLOG_DIR = "backlog";

class TrackerConfigurationError extends Error {
  constructor(value) {
    const rendered = renderValue(value);
    super(
      `Invalid tracker configuration ${rendered}; expected one of: ${TRACKER_KEYS.join(", ")}.`
    );
    this.name = "TrackerConfigurationError";
    this.value = value;
  }
}

class TrackerContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "TrackerContractError";
  }
}

class TrackerIdentityError extends TrackerContractError {
  constructor(message) {
    super(`Invalid tracker identity: ${message}.`);
    this.name = "TrackerIdentityError";
  }
}

class TrackerUnavailableError extends Error {
  constructor(tracker, reason, options = {}) {
    super(
      `Configured tracker "${tracker}" is unavailable: ${reason}. ` +
        "Restore that tracker or change backlog/config.yml explicitly; no fallback was attempted.",
      options
    );
    this.name = "TrackerUnavailableError";
    this.tracker = tracker;
    this.reason = reason;
  }
}

class UnsupportedTrackerCapabilityError extends Error {
  constructor(tracker, capability, configPath = configDisplayPath(DEFAULT_BACKLOG_DIR)) {
    super(`Tracker "${tracker}" does not support capability "${capability}".`);
    this.name = "UnsupportedTrackerCapabilityError";
    this.code = UNSUPPORTED_CAPABILITY_CODE;
    this.tracker = tracker;
    this.capability = capability;
    this.remediation =
      `Use tracker "${tracker}" without "${capability}", or explicitly change ` +
      `${configPath} to a tracker that supports it before retrying. ` +
      "No tracker switch was attempted.";
  }
}

function serializeTrackerError(error) {
  if (!(error instanceof UnsupportedTrackerCapabilityError)) return null;
  return {
    code: error.code,
    tracker: error.tracker,
    capability: error.capability,
    message: error.message,
    remediation: error.remediation,
  };
}

function writeTrackerCliError(error, {
  json = false,
  stdout = process.stdout,
  stderr = process.stderr,
  prefix = "",
} = {}) {
  const serialized = serializeTrackerError(error);
  if (!serialized) return false;
  if (json) {
    stdout.write(`${JSON.stringify({ error: serialized })}\n`);
  } else {
    stderr.write(`${prefix}${serialized.message}\n${serialized.remediation}\n`);
  }
  return true;
}

function renderValue(value) {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === undefined) return "undefined";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function selectTracker(config = {}) {
  const hasSelection =
    config !== null &&
    typeof config === "object" &&
    Object.prototype.hasOwnProperty.call(config, "tracker");
  if (!hasSelection) return "github";

  const selection = config.tracker;
  if (typeof selection !== "string" || !TRACKER_KEYS.includes(selection)) {
    throw new TrackerConfigurationError(selection);
  }
  return selection;
}

function validateAdapter(tracker, adapter) {
  if (adapter === null || typeof adapter !== "object" || Array.isArray(adapter)) {
    throw new TrackerContractError(`Tracker "${tracker}" adapter must be an object.`);
  }

  const actual = Reflect.ownKeys(adapter);
  const missing = REQUIRED_ADAPTER_OPERATIONS.filter((name) => !actual.includes(name));
  const extra = actual.filter((name) => !REQUIRED_ADAPTER_OPERATIONS.includes(name));
  const nonFunctions = REQUIRED_ADAPTER_OPERATIONS.filter(
    (name) => actual.includes(name) && typeof adapter[name] !== "function"
  );

  if (missing.length || extra.length || nonFunctions.length) {
    const details = [];
    if (missing.length) details.push(`missing: ${missing.join(", ")}`);
    if (extra.length) {
      details.push(`not part of the required interface: ${extra.map(String).join(", ")}`);
    }
    if (nonFunctions.length) details.push(`not functions: ${nonFunctions.join(", ")}`);
    throw new TrackerContractError(
      `Tracker "${tracker}" adapter has an invalid operation shape (${details.join("; ")}).`
    );
  }

  return adapter;
}

function availabilityFailure(tracker, reason, cause) {
  return new TrackerUnavailableError(tracker, reason, cause ? { cause } : undefined);
}

function probeConfiguredAdapter(tracker, adapter) {
  let report;
  try {
    report = adapter.availability();
  } catch (error) {
    const reason = error instanceof Error && error.message
      ? `availability probe threw: ${error.message}`
      : `availability probe threw: ${String(error)}`;
    throw availabilityFailure(tracker, reason, error);
  }

  if (report === null || typeof report !== "object" || typeof report.available !== "boolean") {
    throw availabilityFailure(
      tracker,
      "availability probe returned an unusable report (expected { available: boolean, reason? })"
    );
  }

  if (!report.available) {
    const reason = typeof report.reason === "string" && report.reason.trim()
      ? report.reason.trim()
      : "availability probe reported unavailable without an actionable reason";
    throw availabilityFailure(tracker, reason);
  }

  return Object.freeze({ available: true });
}

function resolveTracker(config, { adapters = TRACKER_ADAPTERS } = {}) {
  const tracker = selectTracker(config);
  const adapter = adapters[tracker];
  if (adapter === undefined) {
    throw new TrackerContractError(`No adapter is registered for configured tracker "${tracker}".`);
  }

  validateAdapter(tracker, adapter);
  const availability = probeConfiguredAdapter(tracker, adapter);
  return Object.freeze({ tracker, adapter, availability });
}

function resolveConfiguredTracker(config, { execFile, adapters, backlogDir } = {}) {
  const registered = adapters || {
    ...TRACKER_ADAPTERS,
    github: execFile ? createGithubAdapter({ execFile }) : TRACKER_ADAPTERS.github,
    local: backlogDir ? createLocalAdapter({ backlogDir }) : TRACKER_ADAPTERS.local,
  };
  const resolved = resolveTracker(config, { adapters: registered });
  return Object.freeze({
    ...resolved,
    configPath: configDisplayPath(backlogDir || DEFAULT_BACKLOG_DIR),
  });
}

function validateIdentity(identity) {
  if (
    identity === null ||
    typeof identity !== "object" ||
    Array.isArray(identity) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(identity))
  ) {
    throw new TrackerIdentityError("expected an object with tracker, id, and ref");
  }

  const allowed = ["tracker", "id", "ref", "url"];
  const keys = Reflect.ownKeys(identity);
  const missing = ["tracker", "id", "ref"].filter(
    (key) => !Object.prototype.hasOwnProperty.call(identity, key)
  );
  if (missing.length) {
    throw new TrackerIdentityError(`missing field${missing.length === 1 ? "" : "s"} ${missing.join(", ")}`);
  }
  const extra = keys.filter((key) => !allowed.includes(key));
  if (extra.length) {
    throw new TrackerIdentityError(
      `unexpected field${extra.length === 1 ? "" : "s"} ${extra.map(String).join(", ")}`
    );
  }
  if (!TRACKER_KEYS.includes(identity.tracker)) {
    throw new TrackerIdentityError(`tracker must be one of: ${TRACKER_KEYS.join(", ")}`);
  }
  if (typeof identity.id !== "string" || !identity.id.trim()) {
    throw new TrackerIdentityError("id must be a non-empty opaque string");
  }
  if (typeof identity.ref !== "string" || !identity.ref.trim()) {
    throw new TrackerIdentityError("ref must be a non-empty string");
  }
  if (Object.prototype.hasOwnProperty.call(identity, "url")) {
    if (typeof identity.url !== "string" || !isProviderUrl(identity.url)) {
      throw new TrackerIdentityError("url must be an absolute http(s) URL when present");
    }
  }

  return identity;
}

function isProviderUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function readCapabilities(tracker, adapter) {
  const reported = adapter.capabilities();
  if (!Array.isArray(reported)) {
    throw new TrackerContractError(
      `Tracker "${tracker}" capabilities must be reported as an array.`
    );
  }

  const invalid = reported.filter((name) => !CAPABILITY_NAMES.includes(name));
  const duplicates = reported.filter((name, index) => reported.indexOf(name) !== index);
  if (invalid.length || duplicates.length) {
    const details = [];
    if (invalid.length) details.push(`unknown: ${[...new Set(invalid)].join(", ")}`);
    if (duplicates.length) details.push(`duplicate: ${[...new Set(duplicates)].join(", ")}`);
    throw new TrackerContractError(
      `Tracker "${tracker}" reported invalid capabilities (${details.join("; ")}).`
    );
  }
  return Object.freeze([...reported]);
}

function invokeCapability(resolved, capability, operation, ...args) {
  if (
    resolved === null ||
    typeof resolved !== "object" ||
    typeof resolved.tracker !== "string" ||
    resolved.adapter === null ||
    typeof resolved.adapter !== "object"
  ) {
    throw new TrackerContractError("Capability invocation requires a resolved tracker.");
  }
  if (typeof operation !== "function") {
    throw new TrackerContractError("Capability invocation requires an operation function.");
  }

  const supported = readCapabilities(resolved.tracker, resolved.adapter);
  if (!supported.includes(capability)) {
    throw new UnsupportedTrackerCapabilityError(
      resolved.tracker,
      capability,
      resolved.configPath
    );
  }
  return operation(...args);
}

const TRACKER_ADAPTERS = Object.freeze({
  github: createGithubAdapter(),
  local: createLocalAdapter({ backlogDir: DEFAULT_BACKLOG_DIR }),
});

module.exports = {
  TRACKER_KEYS,
  REQUIRED_ADAPTER_OPERATIONS,
  CAPABILITY_NAMES,
  UNSUPPORTED_CAPABILITY_CODE,
  TRACKER_ADAPTERS,
  TrackerConfigurationError,
  TrackerContractError,
  TrackerIdentityError,
  TrackerUnavailableError,
  UnsupportedTrackerCapabilityError,
  serializeTrackerError,
  writeTrackerCliError,
  selectTracker,
  validateAdapter,
  validateIdentity,
  readCapabilities,
  resolveTracker,
  resolveConfiguredTracker,
  invokeCapability,
  createGithubAdapter,
  createLocalAdapter,
};
