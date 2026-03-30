/**
 * Shared library for dev-backlog Node scripts.
 */

const fs = require("fs");
const path = require("path");

function slugify(text) {
  return text
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function escapeYaml(text) {
  if (/[:"'#{}\[\]|>&*!%@`]/.test(text) || text !== text.trim()) {
    return "'" + text.replace(/'/g, "''") + "'";
  }
  return text;
}

const CONFIG_DEFAULTS = {
  task_prefix: "BACK",
  default_status: "To Do",
  statuses: ["To Do", "In Progress", "Done"],
};

/**
 * Read backlog/config.yml with simple YAML key: value parsing.
 * Returns merged config (file values override defaults).
 * Gracefully falls back to defaults on missing/malformed file.
 */
function readConfig(backlogDir) {
  const configPath = path.join(backlogDir || "backlog", "config.yml");
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (!m) continue;
      let val = m[2].trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      parsed[m[1]] = val;
    }
    return { ...CONFIG_DEFAULTS, ...parsed };
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}

/**
 * Estimate task size from GitHub labels.
 * Size labels (size:S/M/L) override type labels when both present.
 */
function estimateSize(labels) {
  // Size labels take priority (most specific)
  for (const l of labels) {
    if (l === "size:S") return "~15min";
    if (l === "size:M") return "~1hr";
    if (l === "size:L") return "~2hr";
  }
  // Type labels
  for (const l of labels) {
    if (l === "bug" || l === "type:bug") return "~30min";
    if (l === "chore" || l === "type:chore") return "~15min";
    if (l === "feature" || l === "type:feature") return "~1hr";
    if (l === "refactor" || l === "type:refactor") return "~1hr";
    if (l === "docs" || l === "documentation" || l === "type:docs") return "~20min";
  }
  return "";
}

module.exports = { slugify, escapeYaml, readConfig, estimateSize, CONFIG_DEFAULTS };
