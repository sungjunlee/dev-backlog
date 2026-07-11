const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
const SCRIPT_ROOTS = [
  path.join(ROOT, "skills", "dev-backlog", "scripts"),
  path.join(ROOT, "skills", "backlog-triage", "scripts"),
];
const ALLOWED_DIRECT_GH = new Set([
  "skills/dev-backlog/scripts/github-tracker.js",
  "skills/dev-backlog/scripts/github-milestones.js",
  "skills/dev-backlog/scripts/github-mirrors.js",
  "skills/dev-backlog/scripts/progress-sync-github.js",
  "skills/backlog-triage/scripts/triage-github.js",
]);

function productionJavascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return productionJavascriptFiles(file);
    if (!entry.name.endsWith(".js") || entry.name.endsWith(".test.js")) return [];
    return [file];
  });
}

describe("direct gh production ownership", () => {
  it("confines execution to the required adapter and explicit GitHub capability transports", () => {
    const directPattern = /execFile(?:Sync)?\(\s*["']gh["']|^[ \t]*["']gh["'][ \t]*,/m;
    const directFiles = SCRIPT_ROOTS
      .flatMap(productionJavascriptFiles)
      .filter((file) => directPattern.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file))
      .sort();

    assert.deepEqual(directFiles, [...ALLOWED_DIRECT_GH].sort());
  });

  it("removes direct task lifecycle ownership from every migrated generic caller", () => {
    const migrated = [
      "skills/dev-backlog/scripts/lib.js",
      "skills/dev-backlog/scripts/sync-pull.js",
      "skills/dev-backlog/scripts/sprint-init.js",
      "skills/dev-backlog/scripts/status.sh",
      "skills/dev-backlog/scripts/sprint-close.sh",
      "skills/dev-backlog/scripts/sprint-mirror.js",
      "skills/backlog-triage/scripts/triage-collect.js",
      "skills/backlog-triage/scripts/triage-apply.js",
    ];
    const directPattern = /execFile(?:Sync)?\(\s*["']gh["']|^[ \t]*(?:MS="\$MILESTONE" )?gh (?:api|issue|pr)\b|^[ \t]*["']gh["'][ \t]*,/m;
    for (const relative of migrated) {
      assert.doesNotMatch(fs.readFileSync(path.join(ROOT, relative), "utf8"), directPattern, relative);
    }
  });
});
