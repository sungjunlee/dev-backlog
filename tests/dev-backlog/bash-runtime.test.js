const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const TOOLS = path.resolve(__dirname, "../tools");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const { resolveBashExecutable, toBashArgs } = require(path.join(TOOLS, "bash-runtime.js"));

const BASH_ENTRYPOINTS = [
  "status.sh",
  "next.sh",
  "sprint-close.sh",
];

describe("Bash runtime boundary", () => {
  it("uses the ambient Bash command outside Windows", () => {
    assert.equal(resolveBashExecutable({ platform: "linux", env: {} }), "bash");
  });

  it("honors an explicit Bash override", () => {
    assert.equal(
      resolveBashExecutable({ platform: "win32", env: { DEV_BACKLOG_BASH: "X:\\bash.exe" } }),
      "X:\\bash.exe"
    );
  });

  it("derives Git for Windows Bash without selecting ambient WSL Bash", () => {
    const expected = "C:\\Program Files\\Git\\bin\\bash.exe";
    assert.equal(resolveBashExecutable({
      platform: "win32",
      env: {},
      findGit: () => "C:\\Program Files\\Git\\cmd\\git.exe\r\n",
      fileExists: (candidate) => candidate === expected,
    }), expected);
  });

  it("converts only Bash-facing Windows path separators", () => {
    assert.deepEqual(
      toBashArgs(["D:\\repo\\script.sh", "--json"], "win32"),
      ["D:/repo/script.sh", "--json"]
    );
  });

  it("normalizes backslashes before stripping SCRIPT_DIR in bash entrypoints", () => {
    for (const name of BASH_ENTRYPOINTS) {
      const text = fs.readFileSync(path.join(SKILL_SCRIPTS, name), "utf8");
      // Product scripts must normalize Windows \\ → / before bash %/* stripping.
      // Behavioral spawn harnesses for this pattern are unreliable under Git Bash
      // -c escaping.
      assert.ok(
        text.includes("${BASH_SOURCE[0]//\\\\//}"),
        `${name} must normalize backslashes before %/*`,
      );
    }
  });
});
