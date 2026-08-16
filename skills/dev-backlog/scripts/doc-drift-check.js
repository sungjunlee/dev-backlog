#!/usr/bin/env node
/**
 * Verify that every script filename mentioned in agent-facing docs still
 * exists under a skill's scripts/ directory. Catches prose that outlives a
 * deleted script (the `progress-sync` gotchas survived their script's
 * deletion by two weeks before the 2026-08-15 cleanup found them).
 *
 * Usage: ./scripts/doc-drift-check.js [--root PATH] [--json]
 *
 * Behavior:
 *   - Doc surface: skills/<skill>/SKILL.md, skills/<skill>/references/*.md,
 *     and backlog/sprints/_context.md when present.
 *   - Inventory: top-level files under every skills/<skill>/scripts/.
 *   - A `.js`/`.sh` token in a doc must resolve to an inventory basename.
 *   - Glob fragments (`*.test.js` → preceded by `*.`) and known non-script
 *     proper nouns (`Node.js`) are ignored.
 *   - Filename-level only by design; flags and exported symbols are out of
 *     scope for v1 (#367).
 *
 * Exit codes:
 *   0  every mentioned script resolves
 *   1  one or more mentions are dangling
 */

const fs = require("fs");
const path = require("path");

const TOKEN_RE = /[A-Za-z0-9_][A-Za-z0-9_.-]*\.(?:js|sh)\b/g;
const IGNORED_TOKENS = new Set(["Node.js"]);

function usage() {
  return "Usage: doc-drift-check.js [--root PATH] [--json]";
}

function parseArgs(args) {
  const options = { root: ".", json: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--json") options.json = true;
    else if (args[i] === "--root" && args[i + 1]) options.root = args[(i += 1)];
    else throw new Error(`Unknown argument: ${args[i]}\n${usage()}`);
  }
  return options;
}

function listSkillDirs(root) {
  const skillsDir = path.join(root, "skills");
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsDir, entry.name));
}

function collectDocFiles(root) {
  const docs = [];
  for (const skillDir of listSkillDirs(root)) {
    const skillMd = path.join(skillDir, "SKILL.md");
    if (fs.existsSync(skillMd)) docs.push(skillMd);
    const refsDir = path.join(skillDir, "references");
    if (fs.existsSync(refsDir)) {
      for (const name of fs.readdirSync(refsDir).sort()) {
        if (name.endsWith(".md")) docs.push(path.join(refsDir, name));
      }
    }
  }
  const contextMd = path.join(root, "backlog", "sprints", "_context.md");
  if (fs.existsSync(contextMd)) docs.push(contextMd);
  return docs;
}

function collectScriptInventory(root) {
  const inventory = new Set();
  for (const skillDir of listSkillDirs(root)) {
    const scriptsDir = path.join(skillDir, "scripts");
    if (!fs.existsSync(scriptsDir)) continue;
    for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
      if (entry.isFile()) inventory.add(entry.name);
    }
  }
  return inventory;
}

function extractMentions(content) {
  const mentions = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    for (const match of lines[i].matchAll(TOKEN_RE)) {
      const preceding = lines[i].slice(0, match.index);
      if (preceding.endsWith("*.") || preceding.endsWith("*")) continue;
      if (IGNORED_TOKENS.has(match[0])) continue;
      mentions.push({ name: path.basename(match[0]), line: i + 1 });
    }
  }
  return mentions;
}

function checkDocDrift(root) {
  const inventory = collectScriptInventory(root);
  const docs = collectDocFiles(root);
  const dangling = [];
  for (const doc of docs) {
    const content = fs.readFileSync(doc, "utf8");
    for (const mention of extractMentions(content)) {
      if (!inventory.has(mention.name)) {
        dangling.push({ doc: path.relative(root, doc), ...mention });
      }
    }
  }
  return { docs_scanned: docs.length, inventory_size: inventory.size, dangling };
}

function formatReport(result) {
  const lines = [
    `doc-drift-check: scanned ${result.docs_scanned} doc(s) against ${result.inventory_size} script(s).`,
  ];
  for (const item of result.dangling) {
    lines.push(`  DANGLING ${item.doc}:${item.line} mentions ${item.name} (no such script)`);
  }
  lines.push(result.dangling.length === 0 ? "  OK: no dangling script mentions." : `  ${result.dangling.length} dangling mention(s).`);
  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = checkDocDrift(options.root);
  const status = result.dangling.length === 0 ? "ok" : "fail";
  if (options.json) {
    console.log(JSON.stringify({ action: "doc-drift-check", status, ...result }, null, 2));
  } else {
    console.log(formatReport(result));
  }
  process.exit(status === "ok" ? 0 : 1);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
  collectDocFiles,
  collectScriptInventory,
  extractMentions,
  checkDocDrift,
  formatReport,
};
