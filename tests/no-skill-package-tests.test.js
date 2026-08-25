const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(REPO_ROOT, "skills");

function collectTestJsFiles(dir) {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith(".test.js")) found.push(full);
    }
  }
  return found;
}

describe("skill package surface", () => {
  it("contains no *.test.js files under skills/", () => {
    const found = collectTestJsFiles(SKILLS_DIR)
      .map((file) => path.relative(REPO_ROOT, file).split(path.sep).join("/"))
      .sort();
    assert.deepEqual(found, []);
  });
});
