const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  parseArgs,
  collectDocFiles,
  collectScriptInventory,
  extractMentions,
  checkDocDrift,
} = require(path.join(SKILL_SCRIPTS, "doc-drift-check.js"));

const SCRIPT = path.join(SKILL_SCRIPTS, "doc-drift-check.js");
const REPO_ROOT = path.join(__dirname, "..", "..");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "doc-drift-"));
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function makeFixtureRepo({ docLine }) {
  const root = makeTempDir();
  write(path.join(root, "skills", "alpha", "scripts", "real-thing.js"), "");
  write(path.join(root, "skills", "alpha", "scripts", "helper.integration.test.js"), "");
  write(path.join(root, "skills", "alpha", "SKILL.md"), `# Alpha\n\n${docLine}\n`);
  return root;
}

describe("parseArgs", () => {
  it("accepts --root and --json and rejects unknown flags", () => {
    assert.deepEqual(parseArgs(["--json", "--root", "/x"]), { root: "/x", json: true });
    assert.throws(() => parseArgs(["--nope"]), /Unknown argument/);
  });
});

describe("extractMentions", () => {
  it("captures dotted filenames as one token", () => {
    const mentions = extractMentions("run `helper.integration.test.js` now");
    assert.deepEqual(mentions.map((m) => m.name), ["helper.integration.test.js"]);
  });

  it("ignores glob fragments and Node.js while keeping real names", () => {
    const mentions = extractMentions("Needs Node.js 18+; run *.test.js then real-thing.js");
    assert.deepEqual(mentions.map((m) => m.name), ["real-thing.js"]);
  });

  it("reduces path-qualified mentions to their basename", () => {
    const mentions = extractMentions("see scripts/real-thing.js for details");
    assert.deepEqual(mentions.map((m) => m.name), ["real-thing.js"]);
  });
});

describe("checkDocDrift", () => {
  it("passes when every mentioned script exists", () => {
    const root = makeFixtureRepo({ docLine: "Use `real-thing.js` and helper.integration.test.js." });
    const result = checkDocDrift(root);
    assert.equal(result.dangling.length, 0);
    assert.equal(result.docs_scanned, 1);
  });

  it("flags a mention of a deleted script with doc and line", () => {
    const root = makeFixtureRepo({ docLine: "Legacy gotcha: run `progress-sync.js` weekly." });
    const result = checkDocDrift(root);
    assert.equal(result.dangling.length, 1);
    assert.equal(result.dangling[0].name, "progress-sync.js");
    assert.equal(result.dangling[0].line, 3);
    assert.match(result.dangling[0].doc, /SKILL\.md$/);
  });

  it("scans references/ and _context.md when present", () => {
    const root = makeFixtureRepo({ docLine: "ok" });
    write(path.join(root, "skills", "alpha", "references", "guide.md"), "call gone.sh");
    write(path.join(root, "backlog", "sprints", "_context.md"), "also-gone.js broke once");
    const docs = collectDocFiles(root).map((d) => path.relative(root, d));
    assert.equal(docs.length, 3);
    const names = checkDocDrift(root).dangling.map((d) => d.name).sort();
    assert.deepEqual(names, ["also-gone.js", "gone.sh"]);
  });

  it("inventories top-level script files across skills", () => {
    const root = makeFixtureRepo({ docLine: "ok" });
    write(path.join(root, "skills", "beta", "scripts", "other.sh"), "");
    const inventory = collectScriptInventory(root);
    assert.ok(inventory.has("real-thing.js"));
    assert.ok(inventory.has("other.sh"));
  });
});

describe("CLI", () => {
  it("exits 0 with ok JSON on a clean tree and 1 on drift", () => {
    const clean = makeFixtureRepo({ docLine: "Use real-thing.js." });
    const ok = spawnSync("node", [SCRIPT, "--root", clean, "--json"], { encoding: "utf8" });
    assert.equal(ok.status, 0);
    assert.equal(JSON.parse(ok.stdout).status, "ok");

    const drifted = makeFixtureRepo({ docLine: "Use gone-forever.js." });
    const bad = spawnSync("node", [SCRIPT, "--root", drifted, "--json"], { encoding: "utf8" });
    assert.equal(bad.status, 1);
    assert.equal(JSON.parse(bad.stdout).dangling.length, 1);
  });

  it("reports zero dangling mentions against this repository", () => {
    const live = spawnSync("node", [SCRIPT, "--root", REPO_ROOT, "--json"], { encoding: "utf8" });
    assert.equal(live.status, 0, live.stdout + live.stderr);
    const parsed = JSON.parse(live.stdout);
    assert.equal(parsed.dangling.length, 0);
    assert.ok(parsed.docs_scanned >= 2);
  });
});
