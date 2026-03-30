const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { statusFromLabels, priorityFromLabels, structureBody } = require("./sync-pull.js");

describe("statusFromLabels", () => {
  it("returns In Progress for status:in-progress", () => {
    assert.equal(statusFromLabels(["status:in-progress"]), "In Progress");
  });

  it("returns Blocked for status:blocked", () => {
    assert.equal(statusFromLabels(["status:blocked"]), "Blocked");
  });

  it("returns In Review for status:in-review", () => {
    assert.equal(statusFromLabels(["status:in-review"]), "In Review");
  });

  it("defaults to To Do", () => {
    assert.equal(statusFromLabels([]), "To Do");
    assert.equal(statusFromLabels(["type:feature"]), "To Do");
  });

  it("picks first matching status", () => {
    assert.equal(statusFromLabels(["status:in-progress", "status:blocked"]), "In Progress");
  });
});

describe("priorityFromLabels", () => {
  it("returns critical", () => {
    assert.equal(priorityFromLabels(["priority:critical"]), "critical");
  });

  it("returns high", () => {
    assert.equal(priorityFromLabels(["priority:high"]), "high");
  });

  it("returns low", () => {
    assert.equal(priorityFromLabels(["priority:low"]), "low");
  });

  it("defaults to medium", () => {
    assert.equal(priorityFromLabels([]), "medium");
    assert.equal(priorityFromLabels(["type:bug"]), "medium");
  });

  it("respects priority order (critical > high > low)", () => {
    assert.equal(priorityFromLabels(["priority:low", "priority:critical"]), "critical");
  });
});

describe("structureBody", () => {
  it("returns placeholder for null/empty body", () => {
    assert.equal(structureBody(null), "\n## Description\n(No description provided)\n");
    assert.equal(structureBody(""), "\n## Description\n(No description provided)\n");
  });

  it("passes through body that already has ## Description", () => {
    const body = "## Description\nSome text";
    assert.equal(structureBody(body), "\n## Description\nSome text\n");
  });

  it("prepends ## Description to plain body", () => {
    assert.equal(structureBody("Some text"), "\n## Description\nSome text\n");
  });

  it("detects ## Description anywhere in body", () => {
    const body = "Intro\n## Description\nDetails";
    assert.equal(structureBody(body), "\n" + body + "\n");
  });
});
