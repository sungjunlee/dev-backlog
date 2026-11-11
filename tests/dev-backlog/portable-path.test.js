const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  repoDisplayPath,
  toPortablePath,
} = require(path.join(SKILL_SCRIPTS, "portable-path.js"));

describe("portable path boundaries", () => {
  it("normalizes Windows separators in platform-neutral output", () => {
    assert.equal(toPortablePath("backlog\\sprints\\active.md"), "backlog/sprints/active.md");
  });

  it("normalizes repository-relative display paths but preserves outside paths", () => {
    assert.equal(
      repoDisplayPath("C:\\repo", "C:\\repo\\.dev-backlog\\config.yml", path.win32),
      ".dev-backlog/config.yml"
    );
    assert.equal(repoDisplayPath("C:\\repo", "D:\\outside.yml", path.win32), "D:\\outside.yml");
  });
});
