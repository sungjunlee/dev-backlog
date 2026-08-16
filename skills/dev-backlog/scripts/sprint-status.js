"use strict";
/**
 * Shared frontmatter `status:` reader for the spec-drift checkers
 * (objectives-check.js, component-lint.js).
 *
 * Handles the YAML scalar shapes that appear in sprint frontmatter:
 *   status: completed
 *   status: "completed"          / 'completed'
 *   status: completed # comment  / status: "completed" # comment
 * Mismatched quoting (`status: "completed'`) is returned raw and therefore
 * never equals a bare status token — fail-safe: an ambiguous sprint is
 * checked, not skipped.
 */

function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  return match ? match[1] : null;
}

function parseSprintStatus(content) {
  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) return "";
  const line = frontmatter.match(/^status:[ \t]*(.*)$/m);
  if (!line) return "";
  const raw = line[1].trim();
  if (raw === "" || raw.startsWith("#")) return "";
  const quoted =
    raw.match(/^"([^"\n]*)"(?:[ \t]+#.*)?$/) || raw.match(/^'([^'\n]*)'(?:[ \t]+#.*)?$/);
  if (quoted) return quoted[1].trim();
  // Mismatched or unclosed quoting: return raw so it never matches a status.
  if (raw.startsWith('"') || raw.startsWith("'")) return raw;
  // Unquoted scalar: strip an inline comment (whitespace + '#').
  return raw.replace(/[ \t]+#.*$/, "").trim();
}

module.exports = { parseSprintStatus };
