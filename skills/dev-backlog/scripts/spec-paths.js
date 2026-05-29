const fs = require("fs");
const path = require("path");

const CANONICAL_CHARTER_PATH = path.join("spec", "charter.md");
const LEGACY_CHARTER_PATH = "CHARTER.md";

function resolveRepoPath(repoRoot, candidate) {
  return path.isAbsolute(candidate) ? candidate : path.join(repoRoot, candidate);
}

function resolveCharterPath({
  repoRoot = process.cwd(),
  charterPath = null,
  fileExists = fs.existsSync,
} = {}) {
  const candidates = charterPath
    ? [{ path: charterPath, source: "explicit" }]
    : [
        { path: CANONICAL_CHARTER_PATH, source: "canonical" },
        { path: LEGACY_CHARTER_PATH, source: "legacy" },
      ];

  const checkedPaths = candidates.map((candidate) => resolveRepoPath(repoRoot, candidate.path));
  const found = candidates.find((candidate) => fileExists(resolveRepoPath(repoRoot, candidate.path)));

  if (!found) {
    return {
      found: false,
      charterPath: checkedPaths[0],
      source: charterPath ? "explicit" : "absent",
      checkedPaths,
    };
  }

  return {
    found: true,
    charterPath: resolveRepoPath(repoRoot, found.path),
    source: found.source,
    checkedPaths,
  };
}

module.exports = {
  CANONICAL_CHARTER_PATH,
  LEGACY_CHARTER_PATH,
  resolveCharterPath,
};
