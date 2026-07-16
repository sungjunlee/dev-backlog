const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { resolveBashExecutable, toBashArgs } = require("./bash-runtime.js");

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
});
