const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const script = path.join(__dirname, "tracker-status-list.js");

{
  // A local (unconfigured) .tracker must fall back to "(gh not available)", exit 0.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tsl-test-"));
  fs.writeFileSync(path.join(dir, ".tracker"), "local\n", { flag: "wx" });
  const res = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
  assert.equal(res.status, 0, `exit ${res.status}: ${res.stderr}`);
  assert.equal(res.stdout, "(gh not available)\n");
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log("tracker-status-list.test.js: ok");
