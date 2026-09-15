const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const { resolveBashExecutable, toBashArgs } = require(path.join(SKILL_SCRIPTS, "bash-runtime.js"));

const BASH_ENTRYPOINTS = [
  "init.sh",
  "status.sh",
  "next.sh",
  "context-hook.sh",
  "sprint-close.sh",
  "lib.sh",
];

function resolveScriptDirFromBackslashPath(winPath) {
  return spawnSync("bash", ["-c", [
    `_src='${winPath}'`,
    `_src="\${_src//\\\\//}"`,
    `SCRIPT_DIR="\${_src%/*}"`,
    `[ "\$SCRIPT_DIR" = "\$_src" ] && SCRIPT_DIR="."`,
    `SCRIPT_DIR="\$(cd "\$SCRIPT_DIR" && pwd)"`,
    `printf '%s' "\$SCRIPT_DIR"`,
  ].join("\n")], { encoding: "utf8" });
}

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
      assert.ok(
        text.includes("${BASH_SOURCE[0]//\\\\//}"),
        `${name} must normalize backslashes before %/*`,
      );
    }
  });

  it("resolves a Windows backslash script path to the scripts directory", () => {
    const winInit = path.join(SKILL_SCRIPTS, "init.sh").replaceAll("/", "\\");
    const unnormalized = spawnSync("bash", ["-c", [
      `_src='${winInit}'`,
      `SCRIPT_DIR="\${_src%/*}"`,
      `[ "\$SCRIPT_DIR" = "\$_src" ] && SCRIPT_DIR="."`,
      `printf '%s' "\$SCRIPT_DIR"`,
    ].join("\n")], { encoding: "utf8" });
    assert.equal(unnormalized.status, 0, unnormalized.stderr);
    assert.equal(unnormalized.stdout, ".");

    const result = resolveScriptDirFromBackslashPath(winInit);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(result.stdout, "setup-dev-backlog.js")), true);
    assert.equal(path.resolve(result.stdout), path.resolve(SKILL_SCRIPTS));
  });
});
