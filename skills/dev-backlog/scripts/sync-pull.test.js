const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { slugify, escapeYaml, statusFromLabels, priorityFromLabels, structureBody } = require("./sync-pull.js");

describe("slugify", () => {
  it("converts spaces to hyphens", () => {
    assert.equal(slugify("hello world"), "hello-world");
  });

  it("removes special characters", () => {
    assert.equal(slugify("OAuth2 (flow)"), "oauth2-flow");
    assert.equal(slugify("hello@world!"), "hello-world");
  });

  it("collapses multiple hyphens", () => {
    assert.equal(slugify("a---b"), "a-b");
  });

  it("trims leading and trailing hyphens", () => {
    assert.equal(slugify("-hello-"), "hello");
  });

  it("lowercases output", () => {
    assert.equal(slugify("Hello World"), "hello-world");
  });

  it("returns empty string for non-ASCII-only input", () => {
    assert.equal(slugify("인증 시스템"), "");
  });

  it("handles mixed ASCII and non-ASCII", () => {
    assert.equal(slugify("OAuth2 인증"), "oauth2");
  });

  it("returns empty string for empty input", () => {
    assert.equal(slugify(""), "");
  });
});

describe("escapeYaml", () => {
  it("returns plain text unchanged", () => {
    assert.equal(escapeYaml("simple text"), "simple text");
  });

  it("quotes text with colons", () => {
    assert.equal(escapeYaml("key: value"), "'key: value'");
  });

  it("quotes text with special chars", () => {
    assert.equal(escapeYaml("hello #world"), "'hello #world'");
    assert.equal(escapeYaml("a & b"), "'a & b'");
    assert.equal(escapeYaml("100%"), "'100%'");
  });

  it("escapes single quotes by doubling", () => {
    assert.equal(escapeYaml("it's here"), "'it''s here'");
  });

  it("quotes text with leading/trailing whitespace", () => {
    assert.equal(escapeYaml(" padded "), "' padded '");
  });
});

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
