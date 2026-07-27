/**
 * Legacy tracker-selection compatibility.
 *
 * Tracker authority lives in `backlog/.tracker`. This module is the only reader
 * of the older `tracker:` key in `backlog/config.yml`, kept so repositories
 * configured before the move resolve to the same tracker they always did. It
 * never writes; `config.yml` bytes on disk are never touched.
 *
 * It is a separate module because it is a deletable unit: when legacy support is
 * dropped, this file and its tests go away together.
 */

const fs = require("node:fs");
const { parseSimpleYaml } = require("./lib.js");

// `parseSimpleYaml` resolves a repeated top-level key to its last value, and it
// cannot see a quoted key at all. Either shape used to be refused outright by the
// setup tokenizer this replaced, so accepting them would turn a previously
// fail-closed config into a permanent selection file — silently, and possibly
// under the wrong tracker. Scan the raw text for exactly those two shapes before
// trusting the parse. This is deliberately not a YAML parser: only column-zero
// lines can carry top-level authority, so an indented `tracker:` inside a block
// scalar or a nested mapping is correctly invisible here.
function assertUnambiguousTrackerAuthority(raw, configPath, SetupError) {
  let declarations = 0;
  for (const line of raw.split(/\r?\n/)) {
    if (/^\s/.test(line) || !line.trim() || line.trimStart().startsWith("#")) continue;
    if (/^["']tracker["']\s*:/.test(line)) {
      throw new SetupError(
        `Quoted tracker key in ${configPath} obscures tracker authority; ` +
          "write it as an unquoted top-level `tracker:` key, or remove it and run setup again."
      );
    }
    if (/^tracker\s*:/.test(line)) declarations += 1;
  }
  if (declarations > 1) {
    throw new SetupError(
      `Ambiguous tracker authority in ${configPath}: ${declarations} top-level tracker declarations. ` +
        "Leave exactly one, or remove them all and select a tracker explicitly with --tracker."
    );
  }
}

/**
 * Resolve the legacy selection, or report that the config declares none.
 * `assertAllowed` validates the value; `SetupError` is injected so this module
 * raises the same error type the caller already handles.
 */
function readLegacyTracker(configPath, { fs: fsApi = fs, assertAllowed, SetupError } = {}) {
  // Strip a leading BOM before both the scan and the parse: neither the key regex
  // in `parseSimpleYaml` nor the column-zero scan above treats U+FEFF as
  // whitespace, so a `tracker:` key on the very first line of a BOM-prefixed file
  // would read as "no tracker key" and migrate a legacy `local` repository to
  // `github` without an error.
  const raw = fsApi.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
  assertUnambiguousTrackerAuthority(raw, configPath, SetupError);
  const parsed = parseSimpleYaml(raw);
  if (!Object.prototype.hasOwnProperty.call(parsed, "tracker")) {
    return Object.freeze({ found: false, selection: undefined });
  }
  return Object.freeze({
    found: true,
    selection: assertAllowed(parsed.tracker, configPath),
  });
}

module.exports = { assertUnambiguousTrackerAuthority, readLegacyTracker };
