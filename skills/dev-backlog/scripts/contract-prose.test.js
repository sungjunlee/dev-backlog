// This is repo-local because the prose ships byte-identically to every consumer;
// running the same authoring check in backlog-doctor would add no coverage.

const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { STORE_FILE } = require("./local-tracker.js");
const { TRACKER_SELECTION_FILE } = require("./tracker.js");
const ROOT = path.resolve(__dirname, "../../..");
const SURFACES = ["skills/dev-backlog/SKILL.md", "README.md", "spec/system-map.md"];
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function contractBlock(file) {
  const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split(/\r?\n/);
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^```/.test(lines[index])) continue;
    if (start < 0) {
      start = index + 1;
      continue;
    }
    const block = lines.slice(start, index);
    if (/\bgithub\b/i.test(block.join("\n")) && /\blocal\b/i.test(block.join("\n"))) {
      return block.map((text, offset) => ({ text, number: start + offset + 1 }));
    }
    start = -1;
  }
  assert.fail(`${file}:1: no delimited canonical-store contract block found`);
}

function diagnostic(file, line, fact) {
  return `${file}:${line.number}: ${line.text.trim()}\ncontradicts code-derived fact: ${fact}`;
}
function requireLine(file, line, pattern, fact) {
  assert.ok(pattern.test(line.text), diagnostic(file, line, fact));
}
function modeSection(file, block, mode) {
  const start = block.findIndex(({ text }) => new RegExp(`\\b${mode}\\b.*->`, "i").test(text));
  assert.notEqual(start, -1, diagnostic(file, block[0], `${mode} mode must name canonical truth`));
  const next = block.findIndex(({ text }, index) => index > start && /\b(?:github|local)\b.*->/i.test(text));
  return block.slice(start, next < 0 ? block.length : next);
}
function assertDerived(file, mode, section, block) {
  const global = block.find(({ text }) => /derived .*mirrors? in both modes/i.test(text));
  const claim = section.find(({ text }) => /derived/i.test(text) && /tasks?|mirrors?/i.test(text));
  const offender = section.find(({ text }) => /tasks?|completed|mirrors?/i.test(text)) || section[0];
  assert.ok(global || claim, diagnostic(
    file, offender, `task mirrors are derived in ${mode} mode`
  ));
}
function assertNoCanonicalMirrors(file, block) {
  const lines = fs.readFileSync(path.join(ROOT, file), "utf8").split(/\r?\n/);
  const subject = "(?:task files?|(?:backlog/)?tasks/?(?:\\s*\\+\\s*(?:backlog/)?completed/?)?|mirrors?)";
  const forbidden = new RegExp(
    `${subject}\\s+(?:(?:are|is)\\s+(?:the\\s+)?canonical|\\(canonical)`, "i"
  );
  lines.forEach((text, index) => {
    if (forbidden.test(text) || /task files?.*\bcanonical records?\b/i.test(text) ||
        /\bcanonical\s+(?:task files?|tasks|mirrors?)\b/i.test(text)) {
      assert.fail(diagnostic(file, { text, number: index + 1 },
        `only GitHub Issues or backlog/${STORE_FILE} can be canonical task truth`));
    }
  });
  const approved = new RegExp(
    `(?:GitHub Issues|${escape(`backlog/${STORE_FILE}`)})\\s*\\(?canonical\\)?`, "ig");
  block.forEach((line) => {
    const rest = line.text.replace(approved, "");
    if (/\bcanonical\b/i.test(rest) && !/sprints\/.*canonical execution hub/i.test(rest))
      assert.fail(diagnostic(file, line, "no other store can be canonical task truth"));
  });
}
function assertContract(file) {
  const block = contractBlock(file);
  const github = modeSection(file, block, "github");
  const local = modeSection(file, block, "local");
  requireLine(file, block[0], new RegExp(escape(`backlog/${TRACKER_SELECTION_FILE}`)),
    `tracker selection lives in backlog/${TRACKER_SELECTION_FILE}`);
  requireLine(file, github[0], /GitHub Issues.*canonical/i,
    "GitHub Issues are canonical in github mode");
  requireLine(file, local[0], new RegExp(`${escape(`backlog/${STORE_FILE}`)}.*canonical`, "i"),
    `backlog/${STORE_FILE} is canonical in local mode`);
  assertDerived(file, "github", github, block);
  assertDerived(file, "local", local, block);
  assertNoCanonicalMirrors(file, block);
}

for (const file of SURFACES) {
  it(`${file} matches canonical-store code`, () => assertContract(file));
}
