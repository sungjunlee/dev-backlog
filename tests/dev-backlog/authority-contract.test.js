const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const CONTRACT_PATH = path.join(
  ROOT,
  "skills/dev-backlog/references/authority-contract.md"
);
const EXPECTED_STATE_CLASSES = [
  "Task specification",
  "Task lifecycle",
  "Planning fields",
  "Complex execution state",
  "Durable decisions",
  "Historical evidence",
  "Derived retrieval output",
];
const EXPECTED_SOLE_AUTHORITIES = [
  "Configured tracker (GitHub Issue body and acceptance criteria when `.tracker=github`; Backlog.md CLI when `.tracker=files`); the newest posted `## Agent Brief` comment overrides the body, and a `spec_ref:` line in the body overrides both",
  "Configured tracker state and native metadata (GitHub Issue when `.tracker=github`; Backlog.md CLI when `.tracker=files`)",
  "Configured tracker native metadata (GitHub labels, milestone, assignees, and relationships when github; Backlog.md CLI fields when files)",
  "One active sprint file for the admitted track",
  "The bounded `spec/*` contract axis",
  "GitHub repository history",
  "Its named upstream authority",
];

function contract() {
  return fs.readFileSync(CONTRACT_PATH, "utf8");
}

function authorityRows(markdown) {
  const section = markdown
    .split("## Authority and routing table")[1]
    ?.split("\n## ")[0];
  assert.ok(section, "authority and routing table section must exist");

  return section
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| ") && !line.startsWith("| ---"))
    .slice(1)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));
}

it("routes every required state class to one non-empty sole-authority cell", () => {
  const rows = authorityRows(contract());
  assert.deepEqual(rows.map((row) => row[0]), EXPECTED_STATE_CLASSES);
  assert.deepEqual(rows.map((row) => row[1]), EXPECTED_SOLE_AUTHORITIES);

  for (const row of rows) {
    assert.equal(row.length, 4, `${row[0]} must keep the four-column routing shape`);
    assert.ok(row[1], `${row[0]} must name its sole authority`);
  }
});

it("freezes the reduced boundary and complexity-triggered sprint rule", () => {
  const markdown = contract();
  assert.match(markdown, /0 of 17 selected a\s+non-default tracker/);
  assert.match(markdown, /Time is not an admission criterion/);
  assert.match(markdown, /dual-write or bidirectional task state/);
  assert.match(markdown, /fail-closed/);
  assert.match(markdown, /silent adapter fallback to local files/);
  assert.match(markdown, /automatic writes from search, retrieval, summaries, or memory compilers/);

  for (const optional of ["Relay", "Matt Pocock skills", "GitHub Projects", "Backlog.md"]) {
    assert.match(markdown, new RegExp(`\\| ${optional.replace(".", "\\.")} \\|`));
  }
});

it("keeps both no-spec/no-Relay cold-adopter paths explicit", () => {
  const markdown = contract();
  assert.match(markdown, /no `\.dev-backlog\/`, no `spec\/`, and no Relay/);
  assert.match(markdown, /complete a simple Issue → PR path without creating a sprint/);
  assert.match(markdown, /create, resume, and close it using only\s+this bundle/);
});

it("keeps sprint admission and migration boundaries aligned across public docs", () => {
  const read = (relativePath) =>
    fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  const readme = read("README.md");
  const skill = read("skills/dev-backlog/SKILL.md");
  const capabilities = read("spec/capabilities.md");
  const charter = read("spec/charter.md");
  const sprint = read(
    ".dev-backlog/sprints/2026-07-github-native-core-simplification.md"
  );

  assert.match(readme, /Close the sprint explicitly only when a sprint was admitted/);
  assert.match(readme, /Optional surfaces/);
  assert.doesNotMatch(readme, /local-tracker\.json.*sole task authority/);
  assert.match(skill, /^## Sprint Admission$/m);
  assert.match(skill, /gh issue view N --json body,comments/);
  assert.match(skill, /fail-closed/);
  assert.match(skill, /adapter-ports\.md/);
  assert.match(capabilities, /If that read fails, execution stops/);
  assert.match(charter, /one admitted sprint per track/);
  assert.match(sprint, /objectives: \[O10\]/);
  assert.doesNotMatch(sprint, /read-only fallback/);
});
