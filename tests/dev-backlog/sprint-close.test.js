const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { resolveBashExecutable, toBashArgs } = require(path.resolve(__dirname, "../tools/bash-runtime.js"));

const SCRIPTS_DIR = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const { isActiveSprint, completedSprintContent } = require(path.join(SCRIPTS_DIR, "sprint-state.js"));

function closeSprint(t, statusLine, { extraDir, args = [] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sprint-close-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sprintPath = path.join(root, ".dev-backlog", "sprints", "2026-09-close.md");
  fs.mkdirSync(path.dirname(sprintPath), { recursive: true });
  if (extraDir) fs.mkdirSync(path.join(path.dirname(sprintPath), extraDir));
  fs.writeFileSync(sprintPath, [
    "---", statusLine, "---", "", "## Goal", "Done.", "", "## Plan", "- [x] #1 One", "",
    "## Running Context", "", "## Progress", "- 2026-09-29: started",
  ].join("\n") + "\n");
  const result = spawnSync(resolveBashExecutable(), toBashArgs([path.join(SCRIPTS_DIR, "sprint-close.sh"), ...args]), {
    cwd: root,
    encoding: "utf8",
  });
  return { result, content: fs.readFileSync(sprintPath, "utf-8") };
}

describe("sprint-close status flip (#496)", () => {
  for (const statusLine of ["status: active", "status: active ", 'status: "active"', " status: active"]) {
    it(`closes a sprint whose frontmatter reads ${JSON.stringify(statusLine)}`, (t) => {
      const { result, content } = closeSprint(t, statusLine);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(isActiveSprint(content), false);
      assert.match(content, /^[ \t]*status: completed$/m);
    });
  }

  it("changes only the root status, never a nested or block-text status", () => {
    const content = [
      "---", "status: active", "deployment:", "  status: active", "notes: |", "  status: active", "---", "body",
    ].join("\n");
    const next = completedSprintContent(content);
    assert.equal(isActiveSprint(next), false);
    assert.equal(next.split("\n").filter((line) => line === "  status: active").length, 2);
    assert.equal(completedSprintContent("---\nstatus: active\nmilestone: M\nstatus: active\n---\n"), null);
  });

  for (const [frontmatter, title] of [
    ["status: active\nmilestone: 1.20", "1.20"],
    [" status: active\n milestone: Sprint X", "Sprint X"],
    ['status: active\nmilestone: "2026"', "2026"],
  ]) {
    it(`reads the milestone title ${title} through the shared parser for --close-milestone`, (t) => {
      const { result } = closeSprint(t, frontmatter, { args: ["--close-milestone", "--dry-run"] });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(result.stdout.split("\n").some((line) => line.includes("milestone") && line.endsWith(` ${title}`)));
    });
  }

  it("skips a directory named *.md instead of reporting no active sprint", (t) => {
    const { result, content } = closeSprint(t, "status: active", { extraDir: "not-a-sprint.md" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(isActiveSprint(content), false);
  });
});
