const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { slugify, escapeYaml, readConfig, estimateSize, CONFIG_DEFAULTS } = require("./lib.js");

// --- slugify ---

describe("slugify", () => {
  it("converts spaces to hyphens and lowercases", () => {
    assert.equal(slugify("Auth System"), "auth-system");
  });

  it("removes special characters", () => {
    assert.equal(slugify("OAuth2 (flow)"), "oauth2-flow");
    assert.equal(slugify("hello@world!"), "hello-world");
  });

  it("collapses multiple hyphens", () => {
    assert.equal(slugify("a---b"), "a-b");
  });

  it("trims leading and trailing hyphens", () => {
    assert.equal(slugify("-hello-"), "hello");
  });

  it("lowercases output", () => {
    assert.equal(slugify("Hello World"), "hello-world");
  });

  it("returns empty for non-ASCII-only input", () => {
    assert.equal(slugify("인증 시스템"), "");
  });

  it("handles mixed ASCII and non-ASCII", () => {
    assert.equal(slugify("OAuth2 인증"), "oauth2");
  });

  it("returns empty for empty input", () => {
    assert.equal(slugify(""), "");
  });
});

// --- escapeYaml ---

describe("escapeYaml", () => {
  it("returns plain text unchanged", () => {
    assert.equal(escapeYaml("simple text"), "simple text");
  });

  it("quotes text with colons", () => {
    assert.equal(escapeYaml("key: value"), "'key: value'");
  });

  it("quotes text with special chars", () => {
    assert.equal(escapeYaml("hello #world"), "'hello #world'");
    assert.equal(escapeYaml("a & b"), "'a & b'");
    assert.equal(escapeYaml("100%"), "'100%'");
  });

  it("escapes single quotes by doubling", () => {
    assert.equal(escapeYaml("it's here"), "'it''s here'");
  });

  it("quotes text with leading/trailing whitespace", () => {
    assert.equal(escapeYaml(" padded "), "' padded '");
  });
});

// --- estimateSize ---

describe("estimateSize", () => {
  it("returns ~30min for bug labels", () => {
    assert.equal(estimateSize(["bug"]), "~30min");
    assert.equal(estimateSize(["type:bug"]), "~30min");
  });

  it("returns ~15min for chore labels", () => {
    assert.equal(estimateSize(["chore"]), "~15min");
    assert.equal(estimateSize(["type:chore"]), "~15min");
  });

  it("returns ~1hr for feature labels", () => {
    assert.equal(estimateSize(["feature"]), "~1hr");
    assert.equal(estimateSize(["type:feature"]), "~1hr");
  });

  it("returns ~1hr for refactor labels", () => {
    assert.equal(estimateSize(["refactor"]), "~1hr");
    assert.equal(estimateSize(["type:refactor"]), "~1hr");
  });

  it("returns ~20min for docs labels", () => {
    assert.equal(estimateSize(["docs"]), "~20min");
    assert.equal(estimateSize(["documentation"]), "~20min");
    assert.equal(estimateSize(["type:docs"]), "~20min");
  });

  it("returns correct size for size:S/M/L", () => {
    assert.equal(estimateSize(["size:S"]), "~15min");
    assert.equal(estimateSize(["size:M"]), "~1hr");
    assert.equal(estimateSize(["size:L"]), "~2hr");
  });

  it("size labels override type labels", () => {
    assert.equal(estimateSize(["bug", "size:L"]), "~2hr");
    assert.equal(estimateSize(["size:S", "type:feature"]), "~15min");
  });

  it("returns empty for unrecognized labels", () => {
    assert.equal(estimateSize(["priority:high"]), "");
    assert.equal(estimateSize([]), "");
  });
});

// --- readConfig ---

describe("readConfig", () => {
  const tmpDir = path.join(__dirname, "__tmp_config_test__");

  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when config file is missing", () => {
    const config = readConfig(path.join(tmpDir, "nonexistent"));
    assert.equal(config.task_prefix, CONFIG_DEFAULTS.task_prefix);
    assert.equal(config.default_status, CONFIG_DEFAULTS.default_status);
  });

  it("reads task_prefix from valid config", () => {
    fs.writeFileSync(path.join(tmpDir, "config.yml"), 'task_prefix: "PROJ"\n');
    const config = readConfig(tmpDir);
    assert.equal(config.task_prefix, "PROJ");
  });

  it("strips surrounding quotes", () => {
    fs.writeFileSync(path.join(tmpDir, "config.yml"), "task_prefix: 'MY-PREFIX'\n");
    const config = readConfig(tmpDir);
    assert.equal(config.task_prefix, "MY-PREFIX");
  });

  it("merges file values with defaults", () => {
    fs.writeFileSync(path.join(tmpDir, "config.yml"), 'project_name: "test"\n');
    const config = readConfig(tmpDir);
    assert.equal(config.project_name, "test");
    assert.equal(config.task_prefix, "BACK"); // default preserved
  });

  it("handles malformed YAML gracefully", () => {
    fs.writeFileSync(path.join(tmpDir, "config.yml"), "not valid yaml: [\n");
    const config = readConfig(tmpDir);
    // Should still parse what it can or fall back to defaults
    assert.equal(config.task_prefix, "BACK");
  });

  it("handles empty file", () => {
    fs.writeFileSync(path.join(tmpDir, "config.yml"), "");
    const config = readConfig(tmpDir);
    assert.equal(config.task_prefix, "BACK");
  });

  it("preserves array defaults for list values", () => {
    fs.writeFileSync(
      path.join(tmpDir, "config.yml"),
      'statuses: ["To Do", "In Progress", "Done"]\ntask_prefix: "PROJ"\n'
    );
    const config = readConfig(tmpDir);
    assert.ok(Array.isArray(config.statuses), "statuses should remain an array");
    assert.equal(config.task_prefix, "PROJ");
  });
});
