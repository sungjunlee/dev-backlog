const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const SKILL_SCRIPTS = path.resolve(__dirname, "../../skills/dev-backlog/scripts");
const {
  slugify,
  scopesOverlap,
  parseSimpleYaml,
  parseIssueRef,
  parsePlanCheckbox,
  containsIssueRef,
  readTaskAuthority,
} = require(path.join(SKILL_SCRIPTS, "lib.js"));

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

// --- #N plan-ref grammar (GitHub-only since #445) ---

describe("parseIssueRef", () => {
  it("parses a complete GitHub issue ref", () => {
    assert.deepEqual(parseIssueRef("#1"), {
      tracker: "github", id: "1", ref: "#1", issue_number: 1,
    });
    assert.deepEqual(parseIssueRef("#42"), {
      tracker: "github", id: "42", ref: "#42", issue_number: 42,
    });
  });

  it("rejects everything that is not a complete #N ref", () => {
    for (const value of [
      "#0", "#01", "#42.10", "#", "#abc", "#42abc", " #42", "#42 ",
      "BACK-1", "BACK-1.2", "1", "", null, undefined, 42,
    ]) {
      assert.equal(parseIssueRef(value), null, JSON.stringify(value));
    }
  });
});

describe("parsePlanCheckbox", () => {
  it("parses each marker with its ref and title", () => {
    assert.deepEqual(parsePlanCheckbox("- [~] #12 Child [branch:child]"), {
      checkboxState: "~",
      identity: { tracker: "github", id: "12", ref: "#12", issue_number: 12 },
      title: "Child [branch:child]",
    });
    assert.equal(parsePlanCheckbox("- [x] #7").title, "");
    assert.equal(parsePlanCheckbox("- [ ] #7").checkboxState, " ");
  });

  it("returns null for non-checkbox lines and refs outside the grammar", () => {
    for (const line of [
      "- [ ] BACK-1.2 Partial",
      "- [ ] #0 Invalid",
      "- [?] #1 Bad marker",
      "### Batch 1",
      "",
    ]) {
      assert.equal(parsePlanCheckbox(line), null, line);
    }
  });
});

describe("containsIssueRef", () => {
  it("matches only an exact ref and never a prefix", () => {
    const one = parseIssueRef("#1");
    assert.equal(containsIssueRef("- 2026-07-01: #1 started", one), true);
    assert.equal(containsIssueRef("- 2026-07-01: #11 started", one), false);
    assert.equal(containsIssueRef("- 2026-07-01: note#1 started", one), false);
    assert.equal(containsIssueRef("- 2026-07-01: review -> PR #1", one), false);
  });

  it("allows trailing punctuation but not identifier or decimal suffixes", () => {
    const task = parseIssueRef("#42");
    assert.equal(containsIssueRef("- 2026-07-01: completed #42.", task), true);
    assert.equal(containsIssueRef("- 2026-07-01: completed (#42),", task), true);
    assert.equal(containsIssueRef("- 2026-07-01: #42abc is not exact", task), false);
    assert.equal(containsIssueRef("- 2026-07-01: #42_suffix is not exact", task), false);
    assert.equal(containsIssueRef("- 2026-07-01: #42.1 is not an issue ref", task), false);
  });
});

// --- parseSimpleYaml ---

describe("parseSimpleYaml", () => {
  it("strips only quote-aware YAML separation comments", () => {
    assert.deepEqual(
      parseSimpleYaml([
        "status: active # keep",
        "plain: value#suffix",
        "single: 'it''s # inside' # outside",
        'double: "say \\"#\\" here" # outside',
        "count: 75 # outside",
        'items: ["one # inside", two] # outside',
        "",
      ].join("\n")),
      {
        status: "active",
        plain: "value#suffix",
        single: "it's # inside",
        double: 'say \\"#\\" here',
        count: 75,
        items: ["one # inside", "two"],
      }
    );
  });

  it("does not parse block scalar physical content as keys", () => {
    const parsed = parseSimpleYaml([
      "status: active",
      "literal: |",
      "  status: hidden",
      "  component: HIDDEN",
      "folded: &copy !text >-2 # keep",
      "  status: hidden",
      "  component: ALSO-HIDDEN",
      "component: REAL",
      "",
    ].join("\n"));
    assert.equal(parsed.status, "active");
    assert.equal(parsed.component, "REAL");
  });

  it("does not parse multiline quoted scalar content as keys", () => {
    const parsed = parseSimpleYaml([
      "status: active",
      "single: 'first line",
      "  status: hidden",
      "  it''s still quoted",
      "  last line'",
      'double: "first \\"still quoted',
      "  status: hidden",
      '  last line"',
      "component: REAL",
      "",
    ].join("\n"));
    assert.equal(parsed.status, "active");
    assert.equal(parsed.component, "REAL");
  });

  it("parses inline arrays and strips surrounding quotes", () => {
    const parsed = parseSimpleYaml(
      'scope: ["src/auth/**", "src/authz/**"]\ncomponent: \'MY-COMPONENT\'\n'
    );
    assert.deepEqual(parsed.scope, ["src/auth/**", "src/authz/**"]);
    assert.equal(parsed.component, "MY-COMPONENT");
  });

  it("handles malformed and empty input gracefully", () => {
    assert.deepEqual(parseSimpleYaml("not valid yaml: [\n"), {});
    assert.deepEqual(parseSimpleYaml(""), {});
  });
});

describe("scopesOverlap", () => {
  it("component: overlaps only on exact equality", () => {
    assert.equal(scopesOverlap({ component: "auth" }, { component: "auth" }), true);
    assert.equal(scopesOverlap({ component: "auth" }, { component: "billing" }), false);
  });

  it("scope: globs overlap on normalized path-prefix containment", () => {
    assert.equal(scopesOverlap({ scope: ["src/auth/**"] }, { scope: ["src/billing/**"] }), false);
    assert.equal(scopesOverlap({ scope: ["src/auth/**"] }, { scope: ["src/auth/**"] }), true);
    assert.equal(scopesOverlap({ scope: ["src/auth/**"] }, { scope: ["src/auth/session/**"] }), true);
  });

  it("cross-axis or scopeless pairs cannot prove overlap (false)", () => {
    assert.equal(scopesOverlap({ component: "auth" }, { scope: ["src/auth/**"] }), false);
    assert.equal(scopesOverlap({}, {}), false);
    assert.equal(scopesOverlap({ component: "auth" }, {}), false);
  });
});

// --- readTaskAuthority (#476) ---

describe("readTaskAuthority", () => {
  function root(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "task-authority-"));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
  }
  function write(dir, content) {
    fs.writeFileSync(path.join(dir, ".tracker"), content);
  }

  it("defaults to github when .tracker is absent", (t) => {
    assert.equal(readTaskAuthority(root(t)), "github");
  });

  it("reads a declared github value", (t) => {
    const dir = root(t);
    write(dir, "github\n");
    assert.equal(readTaskAuthority(dir), "github");
  });

  it("maps backlog and the legacy files spelling to backlog", (t) => {
    const backlogDir = root(t);
    write(backlogDir, "backlog\n");
    assert.equal(readTaskAuthority(backlogDir), "backlog");

    const filesDir = root(t);
    write(filesDir, "files\n");
    assert.equal(readTaskAuthority(filesDir), "backlog");
  });

  it("reads gitlab case-insensitively", (t) => {
    const dir = root(t);
    write(dir, "GITLAB\n");
    assert.equal(readTaskAuthority(dir), "gitlab");
  });

  it("trims a trailing newline and surrounding whitespace on the first line", (t) => {
    const dir = root(t);
    write(dir, "  backlog  \n");
    assert.equal(readTaskAuthority(dir), "backlog");
  });

  it("reads only the first line, ignoring anything after it", (t) => {
    const dir = root(t);
    write(dir, "github\nbacklog\n");
    assert.equal(readTaskAuthority(dir), "github");
  });

  it("throws on an unknown value, naming the value and the file", (t) => {
    const dir = root(t);
    write(dir, "local\n");
    assert.throws(
      () => readTaskAuthority(dir),
      /Unknown task authority "local" in .*\.tracker; expected github, backlog, or gitlab\./
    );
  });
});
