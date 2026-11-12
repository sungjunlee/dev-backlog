// Contract tests guard parseable relationships, never a sentence or file count.
// Historical wording and deleted prose-only properties remain available in git.
const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");

function parseObjectiveIds(text) {
  const ids = [];
  const pattern = /O(\d+)(?:\s*[–-]\s*O(\d+))?/g;
  let match;
  while ((match = pattern.exec(String(text))) !== null) {
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    for (let n = lo; n <= hi; n += 1) ids.push(`O${n}`);
  }
  return ids;
}

it("expands retired objective ranges and requires the declaration", () => {
  assert.deepEqual(parseObjectiveIds("Retired IDs (never reuse): O3, O5–O9"),
    ["O3", "O5", "O6", "O7", "O8", "O9"]);
  assert.deepEqual(parseObjectiveIds("O5-O7"), ["O5", "O6", "O7"]);
  assert.deepEqual(parseObjectiveIds(""), []);
});

it("keeps living charter objective IDs unique and disjoint from retired IDs", () => {
  const charter = fs.readFileSync(path.join(ROOT, "spec/charter.md"), "utf8");
  const objectivesSection = charter.split(/^## Objectives\b/m)[1]?.split(/^## /m)[0];
  assert.ok(objectivesSection, "charter must have an Objectives section");

  const living = [...objectivesSection.matchAll(/^- (O\d+)\s+[—-]/gm)].map((match) => match[1]);
  const retiredLine = objectivesSection.split(/\r?\n/).find((line) => /Retired IDs/i.test(line));
  assert.ok(retiredLine, "charter must declare retired objective IDs");
  const retired = parseObjectiveIds(retiredLine);
  assert.ok(living.length > 0, "charter must declare at least one living objective");
  assert.ok(retired.length > 0, "retired ID declaration must name at least one ID or range");
  assert.equal(new Set(living).size, living.length, "living objective IDs must be unique");
  assert.equal(new Set(retired).size, retired.length, "retired objective IDs must be unique");
  assert.deepEqual(living.filter((id) => retired.includes(id)), [],
    "a retired objective ID must never be reused as living");

  const synthetic = `${objectivesSection}\n- O6 — Reintroduced interior ID, must fail disjointness`;
  const livingWithReuse = [...synthetic.matchAll(/^- (O\d+)\s+[—-]/gm)].map((match) => match[1]);
  assert.ok(livingWithReuse.includes("O6") && parseObjectiveIds(retiredLine).includes("O6"));
  assert.ok(livingWithReuse.filter((id) => retired.includes(id)).includes("O6"),
    "an interior retired ID such as O6 must be detected as a reuse");
});

it("keeps every living dev-backlog reference reachable without pinning its inventory", () => {
  const skillPath = path.join(ROOT, "skills/dev-backlog/SKILL.md");
  const referencesDir = path.join(ROOT, "skills/dev-backlog/references");
  const skill = fs.readFileSync(skillPath, "utf8");
  const linked = new Set(
    [...skill.matchAll(/references\/([A-Za-z0-9-]+\.md)/g)].map((match) => match[1])
  );
  const living = fs.readdirSync(referencesDir)
    .filter((name) => name.endsWith(".md"));

  assert.ok(living.length > 0, "the skill must have at least one reference contract");
  for (const name of living) {
    assert.ok(linked.has(name), `${name} must be linked from SKILL.md`);
  }
  for (const name of linked) {
    assert.ok(fs.existsSync(path.join(referencesDir, name)),
      `SKILL.md reference must resolve: ${name}`);
  }
});

it("keeps unverified Gitea outside the measured Task Authority table (#503)", () => {
  const skill = fs.readFileSync(path.join(ROOT, "skills/dev-backlog/SKILL.md"), "utf8");
  const authority = skill.split(/^## Task Authority\s*$/m)[1]?.split(/^## /m)[0];
  assert.ok(authority, "SKILL.md must keep a Task Authority section");
  const tableRows = authority.split(/\r?\n/).filter((line) => /^\| `/.test(line));
  assert.equal(tableRows.some((line) => /gitea/i.test(line)), false,
    "Gitea must not enter the Task Authority table without a measured target");
  assert.match(authority, /Gitea is unverified/i);

  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.match(readme, /GitLab is documented but not measured\. Gitea is unverified/i);
});
