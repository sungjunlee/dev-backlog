const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { slugify, estimateSize } = require("./sprint-init.js");

describe("slugify", () => {
  it("converts spaces to hyphens and lowercases", () => {
    assert.equal(slugify("Auth System"), "auth-system");
  });

  it("removes special characters", () => {
    assert.equal(slugify("api-v2 (migration)"), "api-v2-migration");
  });

  it("collapses multiple hyphens", () => {
    assert.equal(slugify("a---b"), "a-b");
  });

  it("trims leading and trailing hyphens", () => {
    assert.equal(slugify("-hello-"), "hello");
  });

  it("returns empty string for non-ASCII-only input", () => {
    assert.equal(slugify("인증시스템"), "");
  });

  it("handles empty input", () => {
    assert.equal(slugify(""), "");
  });
});

describe("estimateSize", () => {
  it("returns ~30min for bug label", () => {
    assert.equal(estimateSize(["bug"]), "~30min");
  });

  it("returns ~30min for type:bug label", () => {
    assert.equal(estimateSize(["type:bug"]), "~30min");
  });

  it("returns ~15min for chore label", () => {
    assert.equal(estimateSize(["chore"]), "~15min");
  });

  it("returns ~15min for type:chore label", () => {
    assert.equal(estimateSize(["type:chore"]), "~15min");
  });

  it("returns empty string for other labels", () => {
    assert.equal(estimateSize(["type:feature", "priority:high"]), "");
  });

  it("returns empty string for no labels", () => {
    assert.equal(estimateSize([]), "");
  });

  it("picks first matching label in iteration order", () => {
    assert.equal(estimateSize(["chore", "bug"]), "~15min");
    assert.equal(estimateSize(["bug", "chore"]), "~30min");
  });
});
