const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

// sprint-init.js no longer exports pure functions — they moved to lib.js.
// This file is kept as a placeholder for future sprint-init-specific tests
// (e.g., main() integration tests with gh CLI mock).

describe("sprint-init", () => {
  it("module loads without error", () => {
    require("./sprint-init.js");
  });
});
