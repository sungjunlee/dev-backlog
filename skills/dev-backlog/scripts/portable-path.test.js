const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  configDisplayPath,
  repoDisplayPath,
  toPortablePath,
} = require("./portable-path.js");

describe("portable path boundaries", () => {
  it("normalizes Windows separators in platform-neutral output", () => {
    assert.equal(toPortablePath("backlog\\sprints\\active.md"), "backlog/sprints/active.md");
  });

  it("normalizes repository-relative display paths but preserves outside paths", () => {
    assert.equal(
      repoDisplayPath("C:\\repo", "C:\\repo\\backlog\\config.yml", path.win32),
      "backlog/config.yml"
    );
    assert.equal(repoDisplayPath("C:\\repo", "D:\\outside.yml", path.win32), "D:\\outside.yml");
  });

  it("normalizes default relative config paths and preserves absolute config paths", () => {
    assert.equal(configDisplayPath("backlog"), "backlog/config.yml");
    assert.equal(
      configDisplayPath("C:\\repo\\backlog", "config.yml", path.win32),
      "C:\\repo\\backlog\\config.yml"
    );
  });
});
