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

// The setup tokenizer this replaced counted a `tracker` key wherever it appeared
// — nested under another key, inside a sequence, inside a flow collection — and
// refused the config when it found more than one, or when the only one was not a
// top-level scalar. `parseSimpleYaml` cannot reproduce that: it resolves a
// repeated top-level key to its last value, ignores nested occurrences entirely,
// and cannot see a quoted key at all. Trusting it alone would turn configs that
// previously failed closed into permanent selection files, silently and possibly
// under the wrong tracker.
//
// This scan restores the refusals without restoring the tokenizer. It is
// deliberately conservative: block-scalar bodies and comments are excluded
// because the old lexer excluded them, and quoted spans are blanked so a
// `tracker:` inside a string is not counted. Anything else that looks like a
// tracker key is counted, so an exotic layout errs toward an actionable refusal
// rather than a silent selection.
function stripUncountedSpans(line) {
  // Blank quoted spans first so a '#' inside a string does not start a comment,
  // then drop the comment tail. Replacement preserves length, keeping offsets.
  const blanked = line.replace(/"[^"]*"|'[^']*'/g, (match) => " ".repeat(match.length));
  const comment = blanked.indexOf("#");
  return comment === -1 ? blanked : blanked.slice(0, comment);
}

function countTrackerKeys(text) {
  return (text.match(/(?:^|[\s\[{,]|-\s)tracker\s*:/g) || []).length;
}

// Two shapes the old lexer decoded and this scan deliberately does not: a
// double-quoted key carrying escapes (`"track\x65r": github`), and an explicit
// mapping key (`? tracker`). Decoding either would mean rebuilding the tokenizer
// this change deleted, so refuse them outright instead. Refusing is safe — these
// are not shapes a config gets by accident — and it keeps the read path from
// silently resolving an authority the old setup would have rejected.
function assertNoUndecodableAuthority(line, refuse) {
  if (/^\?(\s|$)/.test(line.trim())) {
    refuse("an explicit mapping key (`?`) can carry tracker authority this reader does not decode");
  }
  if (/(["'])(?:[^"'\\]|\\.)*\\(?:[^"'\\]|\\.)*\1\s*:/.test(line)) {
    refuse("a quoted key contains escape sequences this reader does not decode");
  }
}

function assertUnambiguousTrackerAuthority(raw, configPath, SetupError) {
  const refuse = (detail) => {
    throw new SetupError(
      `Ambiguous tracker authority in ${configPath}: ${detail}. ` +
        "Leave exactly one top-level `tracker:` key, or remove them all and select a tracker explicitly with --tracker."
    );
  };

  let total = 0;
  let topLevel = 0;
  let blockScalarIndent = null;

  // Tolerate a leading BOM here too, so the scan is correct for direct callers
  // and not only when `readLegacyTracker` has already stripped it. U+FEFF is
  // neither whitespace nor a key character, so leaving it would make a
  // first-line `tracker:` look nested.
  for (const rawLine of raw.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const indent = rawLine.match(/^[ \t]*/)[0].length;
    if (blockScalarIndent !== null) {
      if (!rawLine.trim() || indent > blockScalarIndent) continue;
      blockScalarIndent = null;
    }
    assertNoUndecodableAuthority(rawLine, refuse);

    const line = stripUncountedSpans(rawLine);
    if (!line.trim()) continue;

    if (/^["']tracker["']\s*:/.test(rawLine)) {
      refuse("the tracker key is quoted, which obscures authority");
    }

    const found = countTrackerKeys(line);
    total += found;
    if (found > 0 && /^tracker\s*:/.test(line)) topLevel += 1;

    if (/:\s*[|>][+-]?\d*\s*$/.test(line)) blockScalarIndent = indent;
  }

  if (total > 1) refuse(`${total} tracker declarations were found`);
  if (total === 1 && topLevel === 0) {
    refuse("the only tracker declaration is nested rather than a top-level scalar");
  }
}

/**
 * Resolve the legacy selection, or report that the config declares none.
 * `assertAllowed` validates the value; `SetupError` is injected so this module
 * raises the same error type the caller already handles.
 */
function readLegacyTracker(configPath, { fs: fsApi = fs, assertAllowed, SetupError } = {}) {
  // Strip a leading BOM before both the scan and the parse: neither the key regex
  // in `parseSimpleYaml` nor the scan above treats U+FEFF as
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
