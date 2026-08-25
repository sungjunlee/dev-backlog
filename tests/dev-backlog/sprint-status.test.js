const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const path = require("path");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const { parseSprintStatus } = require(path.join(SKILL_SCRIPTS, "sprint-status.js"));

const fm = (statusLine) => `---\nmilestone: x\n${statusLine}\n---\nbody`;

describe("parseSprintStatus", () => {
  it("parses bare, double-quoted, and single-quoted scalars", () => {
    assert.equal(parseSprintStatus(fm("status: completed")), "completed");
    assert.equal(parseSprintStatus(fm('status: "completed"')), "completed");
    assert.equal(parseSprintStatus(fm("status: 'active'")), "active");
  });

  it("strips inline comments on unquoted and quoted values", () => {
    assert.equal(parseSprintStatus(fm("status: completed # done")), "completed");
    assert.equal(parseSprintStatus(fm('status: "completed" # done')), "completed");
    assert.equal(parseSprintStatus(fm("status: 'completed' # done")), "completed");
  });

  it("returns mismatched quoting raw so it never matches a status token", () => {
    assert.notEqual(parseSprintStatus(fm("status: \"completed'")), "completed");
    assert.notEqual(parseSprintStatus(fm('status: "completed')), "completed");
    assert.notEqual(parseSprintStatus(fm("status: completed'")), "completed");
  });

  it("requires a whole-line frontmatter terminator", () => {
    assert.equal(parseSprintStatus("---\nstatus: completed\n---oops\n"), "");
    assert.equal(parseSprintStatus("---\nstatus: completed\n----\n"), "");
    assert.equal(parseSprintStatus("---\nstatus: completed\n"), "");
    assert.equal(parseSprintStatus("---\nstatus: completed\n---"), "completed");
  });

  it("returns empty for missing frontmatter, missing key, or comment-only value", () => {
    assert.equal(parseSprintStatus("# no frontmatter\nstatus: completed\n"), "");
    assert.equal(parseSprintStatus("---\nmilestone: x\n---\nbody"), "");
    assert.equal(parseSprintStatus(fm("status: # only a comment")), "");
    assert.equal(parseSprintStatus(fm("status:")), "");
  });
});
