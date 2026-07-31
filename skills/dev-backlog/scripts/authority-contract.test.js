const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../..");
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
  "GitHub Issue body and acceptance criteria",
  "GitHub Issue state and native metadata",
  "GitHub Issue native metadata",
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
  assert.match(markdown, /automatic writes from search, retrieval, summaries, or memory compilers/);

  for (const optional of ["Relay", "Matt Pocock skills", "GitHub Projects", "Backlog.md"]) {
    assert.match(markdown, new RegExp(`\\| ${optional.replace(".", "\\.")} \\|`));
  }
});

it("keeps both no-spec/no-Relay cold-adopter paths explicit", () => {
  const markdown = contract();
  assert.match(markdown, /no `backlog\/`, no `spec\/`, and no Relay/);
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
    "backlog/sprints/2026-07-github-native-core-simplification.md"
  );

  assert.match(readme, /Close the sprint explicitly only when a sprint was admitted/);
  assert.match(readme, /`backlog\/local-tracker\.json` remains its sole task authority/);
  assert.match(skill, /`objectives:`\/`component:` are present only when their backing spec files exist/);
  assert.match(skill, /legacy mirror may be inspected only as diagnostic\/rollback evidence/);
  assert.match(capabilities, /If that read fails, execution stops/);
  assert.match(charter, /one admitted sprint per track/);
  assert.match(sprint, /objectives: \[O10\]/);
  assert.doesNotMatch(sprint, /read-only fallback/);
});
