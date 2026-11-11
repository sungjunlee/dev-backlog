const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const CONTRACT_PATH = path.join(
  ROOT,
  "skills/dev-backlog/references/authority-contract.md"
);

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

it("keeps each routed state class unique with one non-empty authority route", () => {
  const rows = authorityRows(contract());
  assert.ok(rows.length > 0, "routing table must contain at least one state class");
  assert.equal(new Set(rows.map((row) => row[0])).size, rows.length,
    "a state class must not acquire two independent routes");

  for (const row of rows) {
    assert.equal(row.length, 4, `${row[0]} must keep the four-column routing shape`);
    assert.ok(row.every(Boolean), `${row[0]} must not contain an empty routing cell`);
  }
});
