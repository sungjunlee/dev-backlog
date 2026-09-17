const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(REPO_ROOT, "skills");

function collectMatchingFiles(dir, predicate) {
  const found = [];
  if (!fs.existsSync(dir)) return found;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && predicate(entry.name)) found.push(full);
    }
  }
  return found;
}

function relativePosix(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join("/");
}

function isTestDouble(name) {
  return (
    name.startsWith("fake-") ||
    name.endsWith("-fixture.js") ||
    (name.endsWith(".cjs") && name.includes("preload")) ||
    name === "smoke-test.sh"
  );
}

describe("skill package surface", () => {
  it("contains no *.test.js files under skills/", () => {
    const found = collectMatchingFiles(SKILLS_DIR, (name) => name.endsWith(".test.js"))
      .map(relativePosix)
      .sort();
    assert.deepEqual(found, []);
  });

  it("contains no test doubles, fixtures, or smoke test under skills/", () => {
    const found = collectMatchingFiles(SKILLS_DIR, isTestDouble)
      .map(relativePosix)
      .sort();
    assert.deepEqual(found, []);
  });
});
