const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveBashExecutable, toBashArgs } = require(path.resolve(__dirname, "../tools/bash-runtime.js"));

const SCRIPTS_DIR = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const { isActiveSprint } = require(path.join(SCRIPTS_DIR, "sprint-state.js"));

function closeSprint(t, statusLine, { extraDir } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sprint-close-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sprintPath = path.join(root, ".dev-backlog", "sprints", "2026-09-close.md");
  fs.mkdirSync(path.dirname(sprintPath), { recursive: true });
  if (extraDir) fs.mkdirSync(path.join(path.dirname(sprintPath), extraDir));
  fs.writeFileSync(sprintPath, [
    "---", statusLine, "---", "", "## Goal", "Done.", "", "## Plan", "- [x] #1 One", "",
    "## Running Context", "", "## Progress", "- 2026-09-29: started",
  ].join("\n") + "\n");
  const result = spawnSync(resolveBashExecutable(), toBashArgs([path.join(SCRIPTS_DIR, "sprint-close.sh")]), {
    cwd: root,
    encoding: "utf8",
  });
  return { result, content: fs.readFileSync(sprintPath, "utf-8") };
}

describe("sprint-close status flip (#496)", () => {
  for (const statusLine of ["status: active", "status: active ", 'status: "active"']) {
    it(`closes a sprint whose frontmatter reads ${JSON.stringify(statusLine)}`, (t) => {
      const { result, content } = closeSprint(t, statusLine);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(isActiveSprint(content), false);
      assert.match(content, /^status: completed$/m);
    });
  }

  it("skips a directory named *.md instead of reporting no active sprint", (t) => {
    const { result, content } = closeSprint(t, "status: active", { extraDir: "not-a-sprint.md" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(isActiveSprint(content), false);
  });
});
