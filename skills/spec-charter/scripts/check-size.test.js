const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  parseArgs,
  stripFrontmatter,
  countWords,
  countLines,
  findDeferredObjectives,
  findLongDecisionsRationale,
  buildSuggestions,
  analyze,
  checkSize,
  formatSummary,
} = require("./check-size.js");

describe("parseArgs", () => {
  it("defaults to spec/charter.md, not strict, not json", () => {
    assert.deepEqual(parseArgs([]), { charterPath: path.join("spec", "charter.md"), strict: false, json: false });
  });

  it("accepts --strict and --json", () => {
    const parsed = parseArgs(["--strict", "--json"]);
    assert.equal(parsed.strict, true);
    assert.equal(parsed.json, true);
  });

  it("accepts --path with value and --path= form", () => {
    assert.equal(parseArgs(["--path", "a/b.md"]).charterPath, "a/b.md");
    assert.equal(parseArgs(["--path=a/b.md"]).charterPath, "a/b.md");
  });

  it("errors on unknown arg", () => {
    assert.match(parseArgs(["--bogus"]).error, /Unknown argument/);
  });

  it("errors on missing value for --path", () => {
    assert.match(parseArgs(["--path"]).error, /Missing value for --path/);
  });
});

describe("stripFrontmatter", () => {
  it("removes leading --- block", () => {
    const result = stripFrontmatter("---\nfoo: bar\n---\nbody\n");
    assert.equal(result, "body\n");
  });

  it("leaves content without frontmatter untouched", () => {
    assert.equal(stripFrontmatter("# heading\nbody\n"), "# heading\nbody\n");
  });

  it("handles unclosed frontmatter by returning original", () => {
    const input = "---\nfoo: bar\nno close";
    assert.equal(stripFrontmatter(input), input);
  });
});

describe("countWords", () => {
  it("counts plain prose words", () => {
    assert.equal(countWords("one two three four"), 4);
  });

  it("ignores markdown bullets and headers", () => {
    assert.equal(countWords("# Heading\n- one\n- two three"), 4);
  });

  it("ignores fenced code blocks", () => {
    const input = "real prose words\n```\ncode goes here that should not count\n```\nmore prose";
    assert.equal(countWords(input), 5);
  });

  it("ignores inline code", () => {
    assert.equal(countWords("use `unused` token here"), 3);
  });

  it("counts link text, not URLs", () => {
    assert.equal(countWords("[click here](https://example.com/path)"), 2);
  });
});

describe("countLines", () => {
  it("counts lines without trailing newline duplication", () => {
    assert.equal(countLines("a\nb\nc\n"), 3);
    assert.equal(countLines("a\nb\nc"), 3);
  });

  it("returns 0 on empty string", () => {
    assert.equal(countLines(""), 0);
  });
});

describe("findDeferredObjectives", () => {
  it("captures all O<n> ids with [deferred] status", () => {
    const body = [
      "- O1 [validated] something",
      "- O2 [active]    something",
      "- O3 [deferred]  something",
      "- O5 [deferred]  another",
    ].join("\n");
    assert.deepEqual(findDeferredObjectives(body), ["O3", "O5"]);
  });

  it("returns empty when none deferred", () => {
    assert.deepEqual(findDeferredObjectives("- O1 [active] x"), []);
  });
});

describe("findLongDecisionsRationale", () => {
  it("flags rows whose rationale exceeds 140 chars", () => {
    const longText = "x".repeat(180);
    const body = [
      "| date       | decision | rationale | supersedes |",
      "| ---------- | -------- | --------- | ---------- |",
      `| 2026-05-01 | short    | ${longText} | — |`,
      "| 2026-05-02 | short    | tiny rationale here | — |",
    ].join("\n");
    const offenders = findLongDecisionsRationale(body);
    assert.equal(offenders.length, 1);
    assert.equal(offenders[0].date, "2026-05-01");
  });

  it("ignores header and separator rows", () => {
    const body = [
      "| date | decision | rationale | supersedes |",
      "| ---- | -------- | --------- | ---------- |",
    ].join("\n");
    assert.deepEqual(findLongDecisionsRationale(body), []);
  });
});

describe("buildSuggestions", () => {
  it("suggests collapsing when 3+ deferred", () => {
    const s = buildSuggestions({
      deferredIds: ["O5", "O6", "O7"],
      longRationale: [],
      wordCount: 500,
      lineCount: 40,
    });
    assert.ok(s.some((line) => line.includes("3 deferred")));
  });

  it("suggests tightening rationale when long entries present", () => {
    const s = buildSuggestions({
      deferredIds: [],
      longRationale: [{ date: "2026-05-01", rationaleLength: 200 }],
      wordCount: 200,
      lineCount: 20,
    });
    assert.ok(s.some((line) => line.includes("2026-05-01")));
  });

  it("returns generic suggestion when over budget but no structural offenders", () => {
    const s = buildSuggestions({
      deferredIds: [],
      longRationale: [],
      wordCount: 1500,
      lineCount: 100,
    });
    assert.equal(s.length, 1);
    assert.match(s[0], /HOW-knowledge|_context\.md/);
  });
});

describe("analyze", () => {
  it("returns ok summary for a small charter", () => {
    const content = "---\nrevision: 1\n---\n\n# Charter\n\n- O1 [active] one outcome";
    const result = analyze(content);
    assert.equal(result.exceeded, false);
    assert.equal(result.overWords, false);
    assert.equal(result.overLines, false);
    assert.ok(result.wordCount >= 3);
    assert.ok(result.readMinutes >= 1);
  });

  it("flags oversized charters", () => {
    const big = "word ".repeat(1500);
    const content = `---\nrevision: 1\n---\n\n# Charter\n\n${big}`;
    const result = analyze(content);
    assert.equal(result.exceeded, true);
    assert.equal(result.overWords, true);
  });

  it("flags overline charters", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `- item ${i}`).join("\n");
    const content = `---\nrevision: 1\n---\n\n${lines}`;
    const result = analyze(content);
    assert.equal(result.overLines, true);
    assert.equal(result.exceeded, true);
  });
});

describe("checkSize", () => {
  it("returns found:false when the file is missing", () => {
    const result = checkSize({
      charterPath: "/no/such/file/CHARTER.md",
      fileExists: () => false,
    });
    assert.equal(result.found, false);
  });

  it("reads and analyzes a real on-disk file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-size-"));
    try {
      const file = path.join(dir, "spec", "charter.md");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, "---\nrevision: 1\n---\n\nHello world\n");
      const result = checkSize({ charterPath: file });
      assert.equal(result.found, true);
      assert.equal(result.exceeded, false);
      assert.equal(result.wordCount, 2);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("formatSummary", () => {
  it("renders the ✓ marker when under budget", () => {
    const result = { wordCount: 200, lineCount: 30, readMinutes: 1, exceeded: false };
    assert.match(formatSummary(result), /✓/);
  });

  it("renders the ⚠ marker when exceeded", () => {
    const result = { wordCount: 1200, lineCount: 90, readMinutes: 6, exceeded: true };
    assert.match(formatSummary(result), /⚠/);
  });
});
