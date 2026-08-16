const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { parseSprintStatus } = require("./sprint-status.js");

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

  it("returns empty for missing frontmatter, missing key, or comment-only value", () => {
    assert.equal(parseSprintStatus("# no frontmatter\nstatus: completed\n"), "");
    assert.equal(parseSprintStatus("---\nmilestone: x\n---\nbody"), "");
    assert.equal(parseSprintStatus(fm("status: # only a comment")), "");
    assert.equal(parseSprintStatus(fm("status:")), "");
  });
});
