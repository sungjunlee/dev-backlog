const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const SURFACES = [
  "skills/dev-backlog/SKILL.md",
  "README.md",
  "CLAUDE.md",
  "spec/system-map.md",
  "skills/dev-backlog/references/integration-contract.md",
];

for (const file of SURFACES) {
  it(`${file} states the standalone GitHub authority`, () => {
    const markdown = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(markdown, /GitHub Issues[^\n]*(?:canonical|authority|source of truth)/i);
    assert.match(
      markdown,
      /(?:no required task mirror|no task-file directory required|optional legacy export)/i,
    );
    assert.doesNotMatch(markdown, /local-tracker\.json\s*\(canonical/i);
    assert.doesNotMatch(markdown, /local-tracker\.js\s*->/i);
  });
}

it("records compatibility subtraction in current decisions and release notes", () => {
  const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8").split("## [0.9.0]")[0];
  const charter = fs.readFileSync(path.join(ROOT, "spec/charter.md"), "utf8");

  assert.match(charter, /Freeze leftover compatibility runtime/);
  assert.match(changelog, /Required task mirrors/);
  assert.match(changelog, /Zero-adopter local tracker/);
  assert.doesNotMatch(changelog, /task mirrors under `backlog\/tasks\/` remain core/);
});

it("keeps the living charter status-free with retired IDs pinned in git", () => {
  const charter = fs.readFileSync(path.join(ROOT, "spec/charter.md"), "utf8");
  const afterObjectives = charter.split(/^## Objectives\b/m);
  assert.equal(afterObjectives.length, 2, "charter must have one ## Objectives heading");
  const between = afterObjectives[1].split(/^## Decisions\b/m);
  assert.equal(between.length, 2, "charter must have ## Decisions after ## Objectives");
  const objectives = between[0];
  assert.match(charter, /^- O10 — /m);
  assert.doesNotMatch(charter, /^- O\d+ \[(?:validated|active|implemented|deferred)\]/m);
  assert.match(objectives, /Retired IDs \(never reuse\): O3, O5[–-]O9/);
  assert.match(
    objectives,
    /https:\/\/github\.com\/sungjunlee\/dev-backlog\/blob\/4fea158\/spec\/charter\.md/,
  );
});

it("pins backlog-sync history at 4fea158 without claiming spec-* texts", () => {
  const capabilities = fs.readFileSync(path.join(ROOT, "spec/capabilities.md"), "utf8");
  const retired = capabilities.split(/^## Capability:/m)[0];
  assert.match(retired, /`backlog-sync` last\s+text at git \[`4fea158`\]/);
  assert.match(
    retired,
    /`spec-charter` \/ `spec-system-map` \/ `spec-grill` \(skills moved to craftkit\)/,
  );
});

it("keeps the actor contract GitHub-only while preserving historical ref parsing", () => {
  const markdown = fs.readFileSync(
    path.join(ROOT, "skills/dev-backlog/references/integration-contract.md"),
    "utf8",
  );
  assert.match(markdown, /accepts exactly one runtime authority: `github`/);
  assert.match(markdown, /Historical compatibility only:/);
  assert.match(markdown, /does not\s+make `local` a valid `\.tracker` selection/);
  assert.doesNotMatch(markdown, /Local Plan items use/);
  assert.doesNotMatch(markdown, /"tracker": "local",\s*\n\s*"capability"/);
  assert.doesNotMatch(markdown, /explicitly change backlog\/\.tracker to a tracker/);
});

it("records the measured Projects decision without adding a core profile", () => {
  const sync = fs.readFileSync(
    path.join(ROOT, "skills/dev-backlog/references/github-sync.md"),
    "utf8",
  );

  assert.match(sync, /Projects are therefore not an\s+adopted dev-backlog profile/);
  assert.match(sync, /Milestones \+ labels remain the planning default/);
  assert.match(sync, /blob\/v0\.10\.0\/docs\/github-projects-projection-pilot\.md/);
});

it("records the historical-retrieval shadow as a concluded no-go", () => {
  const charter = fs.readFileSync(path.join(ROOT, "spec/charter.md"), "utf8");
  const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8")
    .split("## [0.9.0]")[0];

  assert.match(charter, /#350 historical-retrieval shadow is \*\*no-go\*\*/);
  assert.match(charter, /Arm B \(live sources\) suffices/);
  assert.match(charter, /no compiler, no project-memory skill, no committed retrieval artifact/);
  assert.match(changelog, /Historical-retrieval shadow closed no-go/);
  assert.match(changelog, /Arm B \(live GitHub\/Git\/spec\/sprint sources\)/);
  assert.doesNotMatch(changelog, /task mirrors under `backlog\/tasks\/` remain core/);
});
