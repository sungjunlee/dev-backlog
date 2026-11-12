#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("node:child_process");
const { GH_EXEC_DEFAULTS } = require("../../dev-backlog/scripts/lib.js");
const { ANCHOR_PATTERN, parseAnchor } = require("./anchor.js");

const { DEFAULT_BACKLOG_DIR, defaultTriageDir } = require("../../dev-backlog/scripts/execution-root.js");

const DEFAULT_TRIAGE_DIR = defaultTriageDir();
const APPLY_CHECKLIST_HEADING = "## Apply Checklist";
const CHECKBOX_PATTERN = /^ {0,3}-\s+\[([ xX])\]\s+/;
const HTML_BLOCK_TAGS = [
  "address", "article", "aside", "base", "basefont", "blockquote", "body", "caption", "center", "col",
  "colgroup", "dd", "details", "dialog", "dir", "div", "dl", "dt", "fieldset", "figcaption", "figure",
  "footer", "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hr",
  "html", "iframe", "legend", "li", "link", "main", "menu", "menuitem", "nav", "noframes", "ol",
  "optgroup", "option", "p", "param", "search", "section", "summary", "table", "tbody", "td", "tfoot",
  "th", "thead", "title", "tr", "track", "ul",
].join("|");
const HTML_BLOCK_TAG_PATTERN = new RegExp(`^ {0,3}</?(?:${HTML_BLOCK_TAGS})(?=[\\t />]|$)`, "i");
const COMPLETE_HTML_TAG_PATTERN = /^ {0,3}(?:<\/?[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z_:][A-Za-z0-9_.:-]*(?:\s*=\s*(?:[^ "'=<>`]+|'[^']*'|"[^"]*"))?)*\s*\/?>)[ \t]*$/;
const LIST_ITEM_PATTERN = /^( {0,3})([-+*]|\d{1,9}[.)])(?:([ \t]+)(.*))?$/;
const SUPPORTED_VERBS = new Set([
  "close",
  "revisit",
  "close-duplicate",
  "set-priority",
  "assign-milestone",
]);
const UNKNOWN_PRIORITY_PLACEHOLDER = "priority:<existing-if-any>";

// The triage writer is intentionally the only shipped script that reads the
// session's authority line. It has one decision: absent/github may apply;
// every other present value fails before GitHub or the apply log.
function assertGitHubAuthority(backlogDir) {
  const trackerPath = path.join(backlogDir, ".tracker");
  let line;
  try {
    line = fs.readFileSync(trackerPath, "utf-8").split("\n")[0].trim().toLowerCase();
  } catch (error) {
    if (error.code === "EISDIR") {
      throw new Error(`Cannot read task authority: ${trackerPath} is a directory.`);
    }
    if (error.code !== "ENOENT") throw error;
    let dangling = false;
    try { dangling = fs.lstatSync(trackerPath).isSymbolicLink(); } catch { /* absent */ }
    if (fs.existsSync(trackerPath) || dangling) {
      throw new Error(`Cannot read task authority: ${trackerPath} is unreadable.`);
    }
    return;
  }
  if (line !== "github") {
    throw new Error(`task authority is ${JSON.stringify(line)}; triage apply requires github.`);
  }
}

function usage() {
  return "Usage: triage-apply.js <report.md> [--apply] [--yes] [--json]";
}

function parseArgs(args) {
  const options = {
    reportPath: undefined,
    apply: false,
    yes: false,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--yes") {
      options.yes = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg.startsWith("--")) {
      return { ...options, error: `Unknown argument: ${arg}. ${usage()}` };
    }

    if (options.reportPath) {
      return { ...options, error: `Expected exactly one report path. ${usage()}` };
    }

    options.reportPath = arg;
  }

  if (!options.reportPath) {
    return { ...options, error: `Missing required report.md path. ${usage()}` };
  }

  return options;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeArgs(args) {
  const source = isPlainObject(args) ? args : {};
  const normalized = {};

  for (const key of Object.keys(source).sort()) {
    const value = source[key];
    if (typeof value === "string") {
      normalized[key] = value.trim();
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      normalized[key] = value;
      continue;
    }
    normalized[key] = String(value).trim();
  }

  return normalized;
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

// Keys treat the legacy milestone alias `name=` as `milestone=`, so an alias pair in one
// report dedupes and a log written with either spelling matches a rerun with the other.
function canonicalKeyArgs(verb, normalizedArgs) {
  if (verb !== "assign-milestone" || normalizedArgs.name === undefined) return normalizedArgs;
  if (normalizedArgs.milestone !== undefined && normalizedArgs.milestone !== normalizedArgs.name) return normalizedArgs;
  const { name, ...rest } = normalizedArgs;
  return { ...rest, milestone: name };
}

function buildActionKey(action) {
  const normalizedArgs = action.normalizedArgs || normalizeArgs(action.args);
  return `${action.verb}|${action.issueNumber}|${stableSerialize(canonicalKeyArgs(action.verb, normalizedArgs))}`;
}

function parseFrontmatter(text) {
  const lines = String(text || "").split(/\r?\n/);
  if (lines[0] !== "---") return {};

  const endIndex = lines.indexOf("---", 1);
  if (endIndex === -1) {
    throw new Error("Malformed report: frontmatter block is missing its closing --- marker.");
  }

  const frontmatter = {};
  for (let index = 1; index < endIndex; index += 1) {
    const line = lines[index];
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

function listContainerView(line) {
  let content = String(line || "");
  let continuationIndent = 0;
  const listItems = [];
  let match;
  while ((match = content.match(LIST_ITEM_PATTERN))) {
    const markerIndent = columnAfter(match[1], continuationIndent);
    const markerEnd = columnAfter(match[2], markerIndent);
    const listItem = { markerIndent };
    listItems.push(listItem);
    const padding = match[3] || "";
    const child = match[4] || "";
    // A marker-only or whitespace-only first line has the minimum one-column
    // list padding, regardless of how much trailing whitespace it carries.
    if (!child.trim()) {
      continuationIndent = markerEnd + 1;
      listItem.contentIndent = continuationIndent;
      content = "";
      break;
    }
    const paddingEnd = columnAfter(padding, markerEnd);
    const paddingColumns = paddingEnd - markerEnd;
    // More than four columns after a marker means one column of list padding;
    // the rest belongs to the child block and may make it indented code.
    if (paddingColumns > 4) {
      continuationIndent = markerEnd + 1;
      listItem.contentIndent = continuationIndent;
      content = `${" ".repeat(paddingColumns - 1)}${child}`;
      break;
    }
    continuationIndent = paddingEnd;
    listItem.contentIndent = continuationIndent;
    content = child;
  }
  return { content, continuationIndent, listItems };
}

function columnAfter(source, startColumn = 0) {
  let column = startColumn;
  for (const character of String(source || "")) {
    column = character === "\t"
      ? column + (4 - (column % 4))
      : column + 1;
  }
  return column;
}

function leadingIndentColumns(line) {
  const indentation = String(line || "").match(/^[ \t]*/)[0];
  return columnAfter(indentation);
}

function stripContainerContinuation(line, continuationIndent) {
  const source = String(line || "");
  const indentation = source.match(/^[ \t]*/)[0];
  // Expand every tab at its original column before removing the container so
  // a tab that begins exactly at the boundary keeps its residual columns.
  const indentationColumns = columnAfter(indentation);
  if (indentationColumns < continuationIndent) return source;
  return `${" ".repeat(indentationColumns - continuationIndent)}${source.slice(indentation.length)}`;
}

function continuedListContainerView(line, activeContinuationIndent, activeListItems) {
  const source = String(line || "");
  const direct = listContainerView(source);
  if (direct.continuationIndent > 0) {
    const firstMarkerIndent = direct.listItems[0].markerIndent;
    const parentListItems = activeListItems.filter((item) => item.contentIndent <= firstMarkerIndent);
    return {
      ...direct,
      activeContinuationIndent: direct.continuationIndent,
      activeListItems: [
        ...parentListItems,
        ...direct.listItems,
      ],
      startsListItem: true,
      closesActiveItem: parentListItems.length < activeListItems.length,
    };
  }
  if (source.trim() === "") {
    return {
      content: source,
      continuationIndent: 0,
      listItems: [],
      activeContinuationIndent,
      activeListItems,
      startsListItem: false,
    };
  }
  const indentation = leadingIndentColumns(source);
  if (activeContinuationIndent > 0 && indentation >= activeContinuationIndent) {
    return {
      content: stripContainerContinuation(source, activeContinuationIndent),
      continuationIndent: activeContinuationIndent,
      listItems: [],
      activeContinuationIndent,
      activeListItems,
      startsListItem: false,
    };
  }
  return {
    content: source,
    continuationIndent: 0,
    listItems: [],
    activeContinuationIndent: 0,
    activeListItems: [],
    startsListItem: false,
  };
}

function markdownBlockState(lines) {
  const literalLines = new Set();
  const paragraphs = new Map();
  let start = 0;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    for (let index = 0; index <= end; index += 1) literalLines.add(index);
    start = end + 1;
  }

  let fence;
  let htmlBlock;
  let commentBlock;
  let indentedCode;
  let activeContinuationIndent = 0;
  let activeListItems = [];
  let paragraphOpen = false;
  let paragraphContinuationIndent = 0;
  let paragraphListItems = [];
  let paragraphId;
  let nextParagraphId = 1;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    let container = continuedListContainerView(line, activeContinuationIndent, activeListItems);
    // Resolve surviving parent items by their content indentation before
    // applying paragraph-interruption rules. A marker outdented from the
    // current item's content starts a sibling or adjacent list even when its
    // column or marker type changes. A genuinely nested noninterrupting marker
    // remains paragraph text.
    if (
      container.startsListItem
      && paragraphOpen
      && !interruptsParagraph(line)
      && !container.closesActiveItem
    ) {
      container = {
        content: line,
        continuationIndent: 0,
        listItems: [],
        activeContinuationIndent: paragraphContinuationIndent,
        activeListItems: paragraphListItems,
        startsListItem: false,
      };
    }
    if (container.startsListItem) {
      paragraphOpen = false;
      paragraphContinuationIndent = 0;
      paragraphListItems = [];
      paragraphId = undefined;
    }
    const lazyParagraphIndent = (
      !container.startsListItem
      && container.continuationIndent === 0
      && paragraphOpen
      && paragraphContinuationIndent > 0
      && line.trim() !== ""
      && !interruptsParagraph(line)
    ) ? paragraphContinuationIndent : 0;
    if (lazyParagraphIndent > 0) {
      container.activeContinuationIndent = lazyParagraphIndent;
      container.activeListItems = paragraphListItems;
    }
    activeContinuationIndent = container.activeContinuationIndent;
    activeListItems = container.activeListItems;
    if (commentBlock) {
      literalLines.add(index);
      const contextLine = stripContainerContinuation(line, commentBlock.continuationIndent);
      commentBlock.depth += (contextLine.match(/<!--/g) || []).length;
      commentBlock.depth -= (contextLine.match(/-->/g) || []).length;
      if (commentBlock.depth <= 0) commentBlock = undefined;
      continue;
    }

    if (htmlBlock) {
      const contextLine = stripContainerContinuation(line, htmlBlock.continuationIndent);
      if (htmlBlock.end === "blank") {
        if (contextLine.trim() === "") htmlBlock = undefined;
        else literalLines.add(index);
        if (htmlBlock) continue;
      } else {
        literalLines.add(index);
        if (htmlBlock.end.test(contextLine)) htmlBlock = undefined;
        continue;
      }
    }

    if (fence) {
      literalLines.add(index);
      const contextLine = stripContainerContinuation(line, fence.continuationIndent);
      const closing = contextLine.match(/^ {0,3}(`+|~+)[ \t]*$/);
      if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) {
        fence = undefined;
      }
      continue;
    }

    if (indentedCode) {
      const contextLine = stripContainerContinuation(line, indentedCode.continuationIndent);
      if (contextLine.trim() === "" || /^(?: {4}| {0,3}\t)/.test(contextLine)) {
        literalLines.add(index);
        paragraphOpen = false;
        paragraphContinuationIndent = 0;
        paragraphListItems = [];
        paragraphId = undefined;
        continue;
      }
      indentedCode = undefined;
    }

    // A triage anchor is intentionally an HTML comment. It is executable only
    // as a complete standalone line outside every other literal context.
    if (parseAnchor(line)) {
      paragraphOpen = false;
      paragraphContinuationIndent = 0;
      paragraphListItems = [];
      paragraphId = undefined;
      continue;
    }

    const contextLine = container.content;
    if (contextLine.trim() === "") {
      paragraphOpen = false;
      paragraphContinuationIndent = 0;
      paragraphListItems = [];
      paragraphId = undefined;
      continue;
    }
    const opening = contextLine.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (opening) {
      literalLines.add(index);
      fence = {
        character: opening[1][0],
        length: opening[1].length,
        continuationIndent: container.continuationIndent,
      };
      paragraphOpen = false;
      paragraphContinuationIndent = 0;
      paragraphListItems = [];
      paragraphId = undefined;
      continue;
    }

    if (/^ {0,3}<!--/.test(contextLine)) {
      literalLines.add(index);
      const depth = (contextLine.match(/<!--/g) || []).length - (contextLine.match(/-->/g) || []).length;
      if (depth > 0) {
        commentBlock = { depth, continuationIndent: container.continuationIndent };
      }
      paragraphOpen = false;
      paragraphContinuationIndent = 0;
      paragraphListItems = [];
      paragraphId = undefined;
      continue;
    }

    const rawHtmlStarts = [
      { start: /^ {0,3}<(?<tag>pre|script|style|textarea)(?=[\t />]|$)/i, end: undefined },
      { start: /^ {0,3}<\?/, end: /\?>/ },
      { start: /^ {0,3}<!\[CDATA\[/, end: /\]\]>/ },
      { start: /^ {0,3}<![A-Z]/, end: />/ },
    ];
    let rawHtml;
    for (const candidate of rawHtmlStarts) {
      const match = contextLine.match(candidate.start);
      if (!match) continue;
      const end = match.groups?.tag
        ? /<\/(?:pre|script|style|textarea)>/i
        : candidate.end;
      rawHtml = { end };
      break;
    }
    if (rawHtml) {
      literalLines.add(index);
      if (!rawHtml.end.test(contextLine)) {
        htmlBlock = { ...rawHtml, continuationIndent: container.continuationIndent };
      }
      paragraphOpen = false;
      paragraphContinuationIndent = 0;
      paragraphListItems = [];
      paragraphId = undefined;
      continue;
    }

    if (
      HTML_BLOCK_TAG_PATTERN.test(contextLine)
      || (COMPLETE_HTML_TAG_PATTERN.test(contextLine) && !paragraphOpen)
    ) {
      literalLines.add(index);
      htmlBlock = { end: "blank", continuationIndent: container.continuationIndent };
      paragraphOpen = false;
      paragraphContinuationIndent = 0;
      paragraphListItems = [];
      paragraphId = undefined;
      continue;
    }

    if (/^(?: {4}| {0,3}\t)/.test(contextLine) && !paragraphOpen) {
      literalLines.add(index);
      indentedCode = { continuationIndent: container.continuationIndent };
      paragraphContinuationIndent = 0;
      paragraphListItems = [];
      paragraphId = undefined;
      continue;
    }

    paragraphOpen = !interruptsParagraph(contextLine);
    if (paragraphOpen && paragraphId === undefined) {
      paragraphId = nextParagraphId;
      nextParagraphId += 1;
    } else if (!paragraphOpen) {
      paragraphId = undefined;
    }
    paragraphContinuationIndent = paragraphOpen
      ? container.continuationIndent || lazyParagraphIndent
      : 0;
    paragraphListItems = paragraphContinuationIndent > 0
      ? container.activeListItems
      : [];
    if (paragraphOpen) {
      paragraphs.set(index, {
        id: paragraphId,
        continuationIndent: paragraphContinuationIndent,
        listItems: paragraphListItems,
        content: contextLine,
      });
    }
  }
  return { literalLines, paragraphs };
}

function markdownLiteralLines(lines) {
  return markdownBlockState(lines).literalLines;
}

function isApplyChecklistHeading(line) {
  return /^ {0,3}## Apply Checklist[ \t]*$/.test(String(line || ""));
}

function isThematicBreak(line) {
  return /^ {0,3}(?:([-*_])[ \t]*)\1(?:[ \t]*\1)+[ \t]*$/.test(String(line || ""));
}

function interruptsParagraph(line) {
  const source = String(line || "");
  if (parseAnchor(source)) return true;
  if (/^ {0,3}(?:#{1,6}(?:[ \t]+|$)|>|`{3,}|~{3,})/.test(source)) return true;
  if (/^ {0,3}[-+*][ \t]+/.test(source)) return true;
  const ordered = source.match(/^ {0,3}(\d{1,9})[.)][ \t]+/);
  if (ordered && Number(ordered[1]) === 1) return true;
  return isThematicBreak(source);
}

function isSetextHeading(lines, index, literalLines, paragraphs = new Map()) {
  if (index < 0 || index + 1 >= lines.length) return false;
  if (literalLines.has(index) || literalLines.has(index + 1)) return false;
  const paragraphContainer = paragraphs.get(index);
  if (
    paragraphContainer
    && leadingIndentColumns(lines[index + 1]) < paragraphContainer.continuationIndent
  ) return false;
  const underline = paragraphContainer
    ? stripContainerContinuation(lines[index + 1], paragraphContainer.continuationIndent)
    : lines[index + 1];
  if (!/^ {0,3}(?:=+|-+)[ \t]*$/.test(underline)) return false;

  let paragraphStart = index;
  if (paragraphContainer) {
    while (paragraphs.get(paragraphStart - 1)?.id === paragraphContainer.id) {
      paragraphStart -= 1;
    }
  } else {
    while (paragraphStart > 0) {
      const previous = paragraphStart - 1;
      if (literalLines.has(previous) || !lines[previous].trim() || interruptsParagraph(lines[previous])) break;
      paragraphStart = previous;
    }
  }

  const firstLine = paragraphs.get(paragraphStart)?.content ?? lines[paragraphStart];
  if (!firstLine.trim() || /^ {4}/.test(firstLine)) return false;
  if (/^ {0,3}(?:#{1,6}(?:[ \t]+|$)|>|(?:[-+*]|\d{1,9}[.)])[ \t]+)/.test(firstLine)) return false;
  if (isThematicBreak(firstLine)) return false;
  for (let lineIndex = paragraphStart + 1; lineIndex <= index; lineIndex += 1) {
    const paragraphLine = paragraphs.get(lineIndex)?.content ?? lines[lineIndex];
    if (interruptsParagraph(paragraphLine)) return false;
  }

  return true;
}

function parseReport(text) {
  const source = String(text || "");
  const lines = source.split(/\r?\n/);
  const frontmatter = parseFrontmatter(source);
  const { literalLines, paragraphs } = markdownBlockState(lines);
  const anchors = [];
  const parsed = {
    anchors: 0,
    checked: 0,
    unchecked: 0,
    unknown_verb: 0,
  };

  const checklistHeadings = [];
  const anchorLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!literalLines.has(index) && isApplyChecklistHeading(lines[index])) checklistHeadings.push(index);
    if (parseAnchor(lines[index])) anchorLines.push(index);
  }

  if (checklistHeadings.length !== 1) {
    if (checklistHeadings.length === 0 && anchorLines.length > 0) {
      throw new Error(outsideChecklistMessage(anchorLines.map((index) => index + 1)));
    }
    const locations = checklistHeadings.length > 0
      ? ` on lines ${checklistHeadings.map((index) => index + 1).join(", ")}`
      : "";
    throw new Error(
      `Malformed report: expected exactly one ${APPLY_CHECKLIST_HEADING} heading; found ${checklistHeadings.length}${locations}.`
    );
  }

  const checklistStart = checklistHeadings[0] + 1;
  let checklistEnd = lines.length;
  for (let index = checklistStart; index < lines.length; index += 1) {
    if (!literalLines.has(index) && /^ {0,3}#{1,2}(?:\s+|$)/.test(lines[index])) {
      checklistEnd = index;
      break;
    }
    if (isSetextHeading(lines, index, literalLines, paragraphs)) {
      checklistEnd = index;
      break;
    }
  }
  const outsideLines = anchorLines
    .filter((index) => literalLines.has(index) || index < checklistStart || index >= checklistEnd)
    .map((index) => index + 1);
  if (outsideLines.length > 0) {
    throw new Error(outsideChecklistMessage(outsideLines));
  }

  for (let index = checklistStart; index < checklistEnd; index += 1) {
    if (literalLines.has(index)) continue;
    const anchor = parseAnchor(lines[index]);
    if (!anchor) continue;

    let checkboxIndex = index + 1;
    while (checkboxIndex < lines.length && lines[checkboxIndex].trim() === "") {
      checkboxIndex += 1;
    }

    const checkboxLine = lines[checkboxIndex];
    const checkboxMatch = checkboxLine ? checkboxLine.match(CHECKBOX_PATTERN) : null;
    if (!checkboxMatch) {
      throw new Error(
        `Malformed report: triage anchor on line ${index + 1} must be followed by a checkbox line.`
      );
    }

    const checked = checkboxMatch[1].toLowerCase() === "x";
    const knownVerb = SUPPORTED_VERBS.has(anchor.verb);
    const normalizedArgs = normalizeArgs(anchor.args);
    const entry = {
      verb: anchor.verb,
      issueNumber: anchor.issueNumber,
      args: anchor.args,
      normalizedArgs,
      checked,
      knownVerb,
      key: buildActionKey({ verb: anchor.verb, issueNumber: anchor.issueNumber, normalizedArgs }),
      anchorLine: index + 1,
      checkboxLine: checkboxIndex + 1,
      argErrors: anchor.argErrors,
    };

    anchors.push(entry);
    parsed.anchors += 1;
    if (checked) {
      parsed.checked += 1;
    } else {
      parsed.unchecked += 1;
    }
    if (!knownVerb) {
      parsed.unknown_verb += 1;
    }
  }

  const occurrencesByKey = new Map();
  for (const anchor of anchors) {
    if (!occurrencesByKey.has(anchor.key)) occurrencesByKey.set(anchor.key, []);
    occurrencesByKey.get(anchor.key).push(anchor.anchorLine);
  }
  const duplicates = [...occurrencesByKey.values()].filter((lineNumbers) => lineNumbers.length > 1);
  if (duplicates.length > 0) {
    throw new Error(
      `Ambiguous report: each proposal must appear once in ${APPLY_CHECKLIST_HEADING}; `
      + duplicates.map((lineNumbers) => `duplicate action on lines ${lineNumbers.join(", ")}`).join("; ")
      + ". Keep one anchor for each action and explicitly recheck its approval."
    );
  }

  return { frontmatter, anchors, parsed };
}

function outsideChecklistMessage(lineNumbers) {
  const noun = lineNumbers.length === 1 ? "anchor" : "anchors";
  const verb = lineNumbers.length === 1 ? "is" : "are";
  return `Malformed report: triage ${noun} on line${lineNumbers.length === 1 ? "" : "s"} ${lineNumbers.join(", ")} ${verb} outside ${APPLY_CHECKLIST_HEADING}. `
    + `Consolidate actions in ${APPLY_CHECKLIST_HEADING}, remove every outside anchor, and explicitly recheck approvals; unchecking an outside anchor is not sufficient.`;
}

function dedupActions(anchors) {
  const deduped = new Map();

  for (const anchor of anchors) {
    const existing = deduped.get(anchor.key);
    if (!existing) {
      deduped.set(anchor.key, {
        verb: anchor.verb,
        issueNumber: anchor.issueNumber,
        args: anchor.args,
        normalizedArgs: anchor.normalizedArgs,
        checked: anchor.checked,
        knownVerb: anchor.knownVerb,
        key: anchor.key,
        occurrences: [
          {
            anchorLine: anchor.anchorLine,
            checkboxLine: anchor.checkboxLine,
            checked: anchor.checked,
            argErrors: anchor.argErrors,
          },
        ],
      });
      continue;
    }

    if (anchor.checked) {
      existing.checked = true;
    }
    existing.occurrences.push({
      anchorLine: anchor.anchorLine,
      checkboxLine: anchor.checkboxLine,
      checked: anchor.checked,
      argErrors: anchor.argErrors,
    });
  }

  return [...deduped.values()];
}

// Keeps every gh command line under Windows's 32,767-character limit (and so under GitHub's
// comment limit and Linux's per-argument limit), so an accepted action cannot fail at spawn
// time after earlier writes. The one joined argument, the close-duplicate comment, adds only
// a safe-integer target to its reason.
const MAX_ARG_BYTES = 16000;

function validateAcceptedActions(actions) {
  const errors = [];
  const fieldsByIssue = new Map();
  const closesByIssue = new Map();

  for (const action of actions) {
    if (!action.checked || !action.knownVerb) continue;

    const line = action.occurrences.find((occurrence) => occurrence.checked)?.anchorLine
      || action.occurrences[0].anchorLine;
    const location = `line ${line}: triage:${action.verb} #${action.issueNumber}`;
    const args = action.normalizedArgs;
    for (const occurrence of action.occurrences) {
      if (!occurrence.checked) continue;
      for (const message of occurrence.argErrors || []) {
        errors.push(`line ${occurrence.anchorLine}: triage:${action.verb} #${action.issueNumber}: ${message}.`);
      }
    }
    if (!Number.isSafeInteger(action.issueNumber) || action.issueNumber < 1) {
      errors.push(`${location}: issue number must be a positive safe integer.`);
    }
    for (const [key, argValue] of Object.entries(args)) {
      if (String(argValue).includes("\u0000")) {
        errors.push(`${location}: ${key} must not contain a NUL character.`);
      }
      if (Buffer.byteLength(String(argValue), "utf8") > MAX_ARG_BYTES) {
        errors.push(`${location}: ${key} must be at most ${MAX_ARG_BYTES} bytes.`);
      }
    }
    const required = {
      close: ["reason"],
      revisit: ["reason"],
      "close-duplicate": ["target"],
      "set-priority": ["value"],
      "assign-milestone": [],
    }[action.verb];

    for (const key of required) {
      if (!String(args[key] || "").trim()) {
        errors.push(`${location}: ${key} is required and must not be blank.`);
      }
    }

    let field;
    let value;
    if (action.verb === "set-priority") {
      field = "priority";
      value = args.value;
      if (value && !["high", "medium", "low"].includes(value)) {
        errors.push(`${location}: value must be high, medium, or low.`);
      }
    } else if (action.verb === "assign-milestone") {
      field = "milestone";
      value = args.milestone === undefined ? args.name : args.milestone;
      if (!String(value || "").trim()) {
        errors.push(`${location}: milestone is required and must not be blank.`);
      }
      if (args.milestone !== undefined && args.name !== undefined && args.milestone !== args.name) {
        errors.push(`${location}: milestone and legacy name have different values.`);
      }
    } else if (action.verb === "close-duplicate") {
      field = "duplicate target";
      value = args.target;
      if (value && (!/^#[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value.slice(1))))) {
        errors.push(`${location}: target must be #N with a positive issue number.`);
      } else if (value && Number(value.slice(1)) === action.issueNumber) {
        errors.push(`${location}: target must not be the issue itself.`);
      }
    }

    if (action.verb === "close" || action.verb === "close-duplicate") {
      const previousClose = closesByIssue.get(action.issueNumber);
      const bothDuplicates = previousClose?.verb === "close-duplicate" && action.verb === "close-duplicate";
      if (!previousClose) {
        closesByIssue.set(action.issueNumber, { verb: action.verb, target: args.target, line });
      } else if (!(bothDuplicates && previousClose.target !== args.target)) {
        errors.push(`${location}: more than one accepted closing action for #${action.issueNumber}; line ${previousClose.line} already closes it.`);
      }
    }

    if (!field || !value) continue;
    if (!fieldsByIssue.has(action.issueNumber)) fieldsByIssue.set(action.issueNumber, new Map());
    const fields = fieldsByIssue.get(action.issueNumber);
    const previous = fields.get(field);
    if (previous && previous.value !== value) {
      errors.push(`${location}: conflicting ${field} ${JSON.stringify(value)}; line ${previous.line} assigns ${JSON.stringify(previous.value)}.`);
    } else if (previous && field !== "duplicate target") {
      errors.push(`${location}: ${field} ${JSON.stringify(value)} is already assigned on line ${previous.line}; keep one anchor.`);
    } else if (!previous) {
      fields.set(field, { value, line });
    }
  }

  return errors;
}

function formatRevisitComment(reason) {
  return `triage: revisit — ${String(reason || "").trim()}`;
}

function formatDuplicateComment(target, reason) {
  const targetRef = String(target || "").trim();
  const reasonText = String(reason || "").trim();
  return reasonText ? `Duplicate of ${targetRef}. ${reasonText}` : `Duplicate of ${targetRef}.`;
}

function buildPriorityEditCommand(issueNumber, targetValue, currentPriorityLabels) {
  const issue = String(issueNumber);
  const targetLabel = `priority:${String(targetValue || "").trim()}`;
  const labels = Array.isArray(currentPriorityLabels)
    ? currentPriorityLabels.map((label) => String(label).trim()).filter(Boolean)
    : [];
  const uniqueLabels = [...new Set(labels)];
  const toRemove = uniqueLabels.filter((label) => label.startsWith("priority:") && label !== targetLabel);
  const hasTarget = uniqueLabels.includes(targetLabel);

  if (hasTarget && toRemove.length === 0) {
    return [];
  }

  const argv = ["issue", "edit", issue, "--add-label", targetLabel];
  for (const label of toRemove) {
    argv.push("--remove-label", label);
  }
  return [argv];
}

function toGhCommands(action, context = {}) {
  const issue = String(action.issueNumber);
  const args = action.args || {};

  switch (action.verb) {
    case "close":
      return [
        ["issue", "comment", issue, "-b", String(args.reason || "").trim()],
        ["issue", "close", issue],
      ];
    case "revisit":
      return [
        ["issue", "comment", issue, "-b", formatRevisitComment(args.reason)],
      ];
    case "close-duplicate":
      return [
        ["issue", "comment", issue, "-b", formatDuplicateComment(args.target, args.reason)],
        ["issue", "close", issue, "-r", "not planned"],
      ];
    case "set-priority":
      if (Array.isArray(context.currentPriorityLabels)) {
        return buildPriorityEditCommand(issue, args.value, context.currentPriorityLabels);
      }
      return [
        ["issue", "view", issue, "--json", "labels"],
        ["issue", "edit", issue, "--add-label", `priority:${String(args.value || "").trim()}`, "--remove-label", UNKNOWN_PRIORITY_PLACEHOLDER],
      ];
    case "assign-milestone":
      return [
        ["issue", "edit", issue, "--milestone", String(args.milestone ?? args.name ?? "").trim()],
      ];
    default:
      return [];
  }
}

function quoteShellArg(value) {
  const source = String(value);
  if (/^[A-Za-z0-9_./:#=-]+$/.test(source)) return source;
  return `'${source.replace(/'/g, `'\"'\"'`)}'`;
}

function formatGhCommand(argv) {
  return `gh ${argv.map((arg) => quoteShellArg(arg)).join(" ")}`;
}

function trimStderr(stderr) {
  return String(stderr || "").trim().slice(-500);
}

function executeGithub(execFile, args, options = GH_EXEC_DEFAULTS) {
  return execFile("gh", args, options);
}

function runGh(argv, { execFile = execFileSync } = {}) {
  try {
    const stdout = executeGithub(execFile, argv, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout: stdout || "", stderr: "" };
  } catch (error) {
    return {
      status: error.status || 1,
      stdout: typeof error.stdout === "string"
        ? error.stdout
        : error.stdout?.toString?.("utf-8") || "",
      stderr: typeof error.stderr === "string"
        ? error.stderr
        : error.stderr?.toString?.("utf-8") || error.message,
    };
  }
}

function parseGhLabels(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse gh issue view JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.labels)) {
    throw new Error("Malformed gh issue view response: expected { labels: [] }.");
  }

  return parsed.labels
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter(Boolean);
}

function extractCommandArrays(value) {
  if (!Array.isArray(value)) return [];
  if (value.every((entry) => typeof entry === "string")) {
    return [value];
  }
  return value.filter(
    (entry) => Array.isArray(entry) && entry.every((part) => typeof part === "string")
  );
}

function readApplyLog(logPath, readFile = fs.readFileSync) {
  let raw;
  try {
    raw = readFile(logPath, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        entries: [],
        appliedCommandsByAction: new Map(),
      };
    }
    throw new Error(`Failed to read apply log at ${logPath}: ${error.message}`);
  }

  const entries = [];
  const appliedCommandsByAction = new Map();
  const lines = raw.split(/\r?\n/).filter(Boolean);

  for (let index = 0; index < lines.length; index += 1) {
    let entry;
    try {
      entry = JSON.parse(lines[index]);
    } catch (error) {
      throw new Error(`Malformed apply log at ${logPath}: line ${index + 1} is not valid JSON.`);
    }

    entries.push(entry);
    if (entry.result !== "applied") continue;
    if (typeof entry.verb !== "string" || !Number.isInteger(entry.issue)) continue;

    const key = buildActionKey({
      verb: entry.verb,
      issueNumber: entry.issue,
      args: entry.args || {},
      normalizedArgs: normalizeArgs(entry.args || {}),
    });
    const commands = extractCommandArrays(entry.gh_argv);
    if (commands.length === 0) continue;

    if (!appliedCommandsByAction.has(key)) {
      appliedCommandsByAction.set(key, new Set());
    }
    const commandSet = appliedCommandsByAction.get(key);
    for (const command of commands) {
      commandSet.add(stableSerialize(command));
    }
  }

  return {
    entries,
    appliedCommandsByAction,
  };
}

function appendLogLine(logPath, entry, appendFile = fs.appendFileSync, mkdir = fs.mkdirSync) {
  mkdir(path.dirname(logPath), { recursive: true });
  appendFile(logPath, `${JSON.stringify(entry)}\n`);
}

function preflightApplyLog(logPath, appendFile = fs.appendFileSync, mkdir = fs.mkdirSync) {
  try {
    mkdir(path.dirname(logPath), { recursive: true });
    appendFile(logPath, "");
  } catch (error) {
    throw new Error(`Apply log is not appendable at ${logPath}: ${error.message}`);
  }
}

function buildLogEntry(action, result, ghArgv, timestamp, extra = {}) {
  const entry = {
    timestamp,
    issue: action.issueNumber,
    verb: action.verb,
    args: action.args,
    result,
    gh_argv: ghArgv,
  };

  if (extra.stderr_tail) {
    entry.stderr_tail = trimStderr(extra.stderr_tail);
  }

  return entry;
}

function resolveReportDate(frontmatter, nowIso) {
  const generated = String(frontmatter.generated || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(generated)) {
    return generated;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(generated)) {
    return generated.slice(0, 10);
  }
  return String(nowIso).slice(0, 10);
}

function resolveLogPath(reportDate, cwd) {
  return path.resolve(cwd, DEFAULT_TRIAGE_DIR, `${reportDate}-apply.log`);
}

function readLineSync(inputFd = 0) {
  const buffer = Buffer.alloc(1);
  let line = "";

  while (true) {
    const bytesRead = fs.readSync(inputFd, buffer, 0, 1, null);
    if (bytesRead === 0) break;
    const char = buffer.toString("utf-8", 0, bytesRead);
    if (char === "\n") break;
    if (char !== "\r") line += char;
  }

  return line;
}

function confirmApply({ output = process.stderr, inputFd = 0 } = {}) {
  output.write("Type `yes` to proceed: ");
  return readLineSync(inputFd).trim() === "yes";
}

function ensureApplyAllowed(options, deps) {
  if (!options.apply) return;
  if (options.yes) return;

  const stdinIsTTY = deps.stdinIsTTY ?? Boolean(process.stdin.isTTY);
  const stdoutIsTTY = deps.stdoutIsTTY ?? Boolean(process.stdout.isTTY);

  if (!stdinIsTTY || !stdoutIsTTY) {
    throw new Error("Refusing to mutate GitHub in non-interactive mode without --yes. Re-run with --apply --yes.");
  }

  const confirmed = (deps.confirmApply || confirmApply)({
    output: deps.stderr || process.stderr,
    inputFd: deps.inputFd ?? 0,
  });

  if (!confirmed) {
    throw new Error("Apply aborted. Re-run with --apply --yes to skip confirmation.");
  }
}

function recordLog(logPath, action, result, ghArgv, deps, extra = {}) {
  const timestamp = deps.now();
  const entry = buildLogEntry(action, result, ghArgv, timestamp, extra);
  appendLogLine(logPath, entry, deps.appendFile, deps.mkdir);
  return entry;
}

function tryRecordLog(logPath, action, result, ghArgv, deps, extra = {}) {
  try {
    return { ok: true, entry: recordLog(logPath, action, result, ghArgv, deps, extra) };
  } catch (error) {
    return { ok: false, error };
  }
}

function logAppendFailure(logPath, error) {
  return `Failed to append apply log at ${logPath}: ${error.message}. No further commands were attempted.`;
}

function uncertainEffectFailure(logPath, argv, error) {
  return `Apply log append failed after GitHub reported success for ${formatGhCommand(argv)}: ${error.message}. `
    + `The effect may have completed but was not durably logged at ${logPath}. Verify remote state before manual recovery; do not blindly rerun this report.`;
}

function applyAcceptedAction(action, context) {
  const actionKey = action.key || buildActionKey(action);
  const appliedCommands = context.appliedCommandsByAction.get(actionKey) || new Set();
  let plannedCommands;

  if (action.verb === "set-priority") {
    if (appliedCommands.size > 0) {
      const recorded = tryRecordLog(context.logPath, action, "already-applied", [], context.deps);
      if (!recorded.ok) {
        return { ok: false, message: logAppendFailure(context.logPath, recorded.error) };
      }
      return {
        ok: true,
        action: {
          verb: action.verb,
          issueNumber: action.issueNumber,
          args: action.args,
          gh_argv: [],
          result: "already-applied",
          log: recorded.entry,
        },
      };
    }

    const viewArgv = ["issue", "view", String(action.issueNumber), "--json", "labels"];
    const viewResult = context.deps.runGh(viewArgv);
    if (viewResult.status !== 0) {
      const recorded = tryRecordLog(context.logPath, action, "error", [viewArgv], context.deps, {
        stderr_tail: viewResult.stderr,
      });
      if (!recorded.ok) {
        return {
          ok: false,
          message: `${logAppendFailure(context.logPath, recorded.error)} GitHub also failed: ${trimStderr(viewResult.stderr)}`,
        };
      }
      return {
        ok: false,
        error: recorded.entry,
      };
    }

    let labels;
    try {
      labels = parseGhLabels(viewResult.stdout);
    } catch (error) {
      const recorded = tryRecordLog(context.logPath, action, "error", [viewArgv], context.deps, {
        stderr_tail: error.message,
      });
      if (!recorded.ok) {
        return { ok: false, message: logAppendFailure(context.logPath, recorded.error) };
      }
      return {
        ok: false,
        error: recorded.entry,
      };
    }

    plannedCommands = toGhCommands(action, { currentPriorityLabels: labels });
    if (plannedCommands.length === 0) {
      const recorded = tryRecordLog(context.logPath, action, "already-applied", [], context.deps);
      if (!recorded.ok) {
        return { ok: false, message: logAppendFailure(context.logPath, recorded.error) };
      }
      return {
        ok: true,
        action: {
          verb: action.verb,
          issueNumber: action.issueNumber,
          args: action.args,
          gh_argv: [],
          result: "already-applied",
          log: recorded.entry,
        },
      };
    }
  } else {
    plannedCommands = toGhCommands(action);
  }

  const missingCommands = plannedCommands.filter(
    (argv) => !appliedCommands.has(stableSerialize(argv))
  );

  if (missingCommands.length === 0) {
    const recorded = tryRecordLog(context.logPath, action, "already-applied", plannedCommands, context.deps);
    if (!recorded.ok) {
      return { ok: false, message: logAppendFailure(context.logPath, recorded.error) };
    }
    return {
      ok: true,
      action: {
        verb: action.verb,
        issueNumber: action.issueNumber,
        args: action.args,
        gh_argv: plannedCommands,
        result: "already-applied",
        log: recorded.entry,
      },
    };
  }

  const executedCommands = [];
  for (const argv of missingCommands) {
    const result = context.deps.runGh(argv);
    if (result.status !== 0) {
      const recorded = tryRecordLog(context.logPath, action, "error", [argv], context.deps, {
        stderr_tail: result.stderr,
      });
      if (!recorded.ok) {
        return {
          ok: false,
          message: `${logAppendFailure(context.logPath, recorded.error)} GitHub also failed: ${trimStderr(result.stderr)}`,
          action: {
            verb: action.verb,
            issueNumber: action.issueNumber,
            args: action.args,
            gh_argv: plannedCommands,
            executed_gh_argv: executedCommands,
            result: "error",
          },
        };
      }
      return {
        ok: false,
        error: recorded.entry,
        action: {
          verb: action.verb,
          issueNumber: action.issueNumber,
          args: action.args,
          gh_argv: plannedCommands,
          executed_gh_argv: executedCommands,
          result: "error",
        },
      };
    }

    const recorded = tryRecordLog(context.logPath, action, "applied", [argv], context.deps);
    if (!recorded.ok) {
      return {
        ok: false,
        message: uncertainEffectFailure(context.logPath, argv, recorded.error),
        action: {
          verb: action.verb,
          issueNumber: action.issueNumber,
          args: action.args,
          gh_argv: plannedCommands,
          executed_gh_argv: executedCommands,
          attempted_gh_argv: argv,
          result: "error",
        },
      };
    }
    executedCommands.push(argv);
    if (!context.appliedCommandsByAction.has(actionKey)) {
      context.appliedCommandsByAction.set(actionKey, new Set());
    }
    context.appliedCommandsByAction.get(actionKey).add(stableSerialize(argv));
  }

  return {
    ok: true,
    action: {
      verb: action.verb,
      issueNumber: action.issueNumber,
      args: action.args,
      gh_argv: plannedCommands,
      executed_gh_argv: executedCommands,
      result: "applied",
    },
  };
}

function summarizeResults(actions, skipped) {
  const counts = new Map();

  for (const action of actions) {
    counts.set(action.result, (counts.get(action.result) || 0) + 1);
  }
  for (const entry of skipped) {
    counts.set(entry.result, (counts.get(entry.result) || 0) + 1);
  }

  return counts;
}

function renderText(result) {
  const lines = [];

  for (const action of result.actions) {
    if (action.result === "dry-run") {
      for (const argv of action.gh_argv) {
        lines.push(`DRY-RUN: ${formatGhCommand(argv)}`);
      }
      continue;
    }

    if (action.result === "applied") {
      for (const argv of action.executed_gh_argv || []) {
        lines.push(`APPLY: ${formatGhCommand(argv)}`);
      }
      continue;
    }

    if (action.result === "already-applied") {
      lines.push(`ALREADY-APPLIED: triage:${action.verb} #${action.issueNumber}`);
    }
  }

  for (const skipped of result.skipped) {
    const reason =
      skipped.result === "skipped-pending"
        ? "unchecked"
        : "unknown verb";
    lines.push(`SKIP: triage:${skipped.verb} #${skipped.issueNumber} (${reason})`);
  }

  const counts = summarizeResults(result.actions, result.skipped);
  lines.push(
    `Summary: ${[
      `dry-run=${counts.get("dry-run") || 0}`,
      `applied=${counts.get("applied") || 0}`,
      `already-applied=${counts.get("already-applied") || 0}`,
      `skipped-pending=${counts.get("skipped-pending") || 0}`,
      `skipped-unknown-verb=${counts.get("skipped-unknown-verb") || 0}`,
    ].join(", ")}`
  );

  return `${lines.join("\n")}\n`;
}

function execute(argv = process.argv.slice(2), deps = {}) {
  const options = parseArgs(argv);
  if (options.error) {
    return {
      exitCode: 1,
      error: options.error,
    };
  }

  const cwd = deps.cwd || process.cwd();
  const reportPath = path.resolve(cwd, options.reportPath);
  const now = deps.now || (() => new Date().toISOString());

  let reportText;
  try {
    reportText = (deps.readFile || fs.readFileSync)(reportPath, "utf-8");
  } catch (error) {
    return {
      exitCode: 1,
      error: `Failed to read report at ${reportPath}: ${error.message}`,
    };
  }

  let report;
  try {
    report = parseReport(reportText);
  } catch (error) {
    return {
      exitCode: 1,
      error: error.message,
    };
  }

  const deduped = dedupActions(report.anchors);
  const validationErrors = validateAcceptedActions(deduped);
  if (validationErrors.length > 0) {
    return {
      exitCode: 1,
      error: `Invalid accepted triage actions:\n${validationErrors.map((error) => `- ${error}`).join("\n")}`,
    };
  }

  if (options.apply) {
    try {
      assertGitHubAuthority(path.resolve(cwd, DEFAULT_BACKLOG_DIR));
    } catch (error) {
      return { exitCode: 1, error: `Cannot apply triage actions: ${error.message}` };
    }
  }

  try {
    ensureApplyAllowed(options, {
      confirmApply: deps.confirmApply,
      stderr: deps.stderr,
      stdinIsTTY: deps.stdinIsTTY,
      stdoutIsTTY: deps.stdoutIsTTY,
      inputFd: deps.inputFd,
    });
  } catch (error) {
    return {
      exitCode: 1,
      error: error.message,
    };
  }

  const applyMode = options.apply ? "apply" : "dry-run";
  const result = {
    report: reportPath,
    parsed: report.parsed,
    deduped: deduped.length,
    actions: [],
    skipped: [],
    apply_mode: applyMode,
  };

  let logPath;
  let appliedCommandsByAction = new Map();
  let providerRunGh;
  if (options.apply) {
    providerRunGh = deps.runGh
      || ((argvToRun) => runGh(argvToRun, { execFile: deps.execFile || execFileSync }));

    const reportDate = resolveReportDate(report.frontmatter, now());
    logPath = resolveLogPath(reportDate, cwd);

    try {
      const logState = readApplyLog(logPath, deps.readFile || fs.readFileSync);
      appliedCommandsByAction = logState.appliedCommandsByAction;
      preflightApplyLog(
        logPath,
        deps.appendFile || fs.appendFileSync,
        deps.mkdir || fs.mkdirSync
      );
    } catch (error) {
      return {
        exitCode: 1,
        error: `Cannot apply triage actions: ${error.message}`,
      };
    }
  }

  const effectDeps = {
    now,
    runGh: options.apply
      ? providerRunGh
      : deps.runGh || ((argvToRun) => runGh(argvToRun, { execFile: deps.execFile || execFileSync })),
    appendFile: deps.appendFile || fs.appendFileSync,
    mkdir: deps.mkdir || fs.mkdirSync,
  };

  for (const action of deduped) {
    if (!action.checked) {
      result.skipped.push({
        verb: action.verb,
        issueNumber: action.issueNumber,
        reason: "unchecked",
        result: "skipped-pending",
      });
      if (options.apply) {
        const recorded = tryRecordLog(logPath, action, "skipped-pending", toGhCommands(action), effectDeps);
        if (!recorded.ok) {
          return { ...result, exitCode: 1, error: logAppendFailure(logPath, recorded.error) };
        }
      }
      continue;
    }

    if (!action.knownVerb) {
      result.skipped.push({
        verb: action.verb,
        issueNumber: action.issueNumber,
        reason: "unknown verb",
        result: "skipped-unknown-verb",
      });
      if (options.apply) {
        const recorded = tryRecordLog(logPath, action, "skipped-unknown-verb", [], effectDeps);
        if (!recorded.ok) {
          return { ...result, exitCode: 1, error: logAppendFailure(logPath, recorded.error) };
        }
      }
      continue;
    }

    if (!options.apply) {
      result.actions.push({
        verb: action.verb,
        issueNumber: action.issueNumber,
        args: action.args,
        gh_argv: toGhCommands(action),
        result: "dry-run",
      });
      continue;
    }

    const applied = applyAcceptedAction(action, {
      logPath,
      appliedCommandsByAction,
      deps: effectDeps,
    });

    if (!applied.ok) {
      if (applied.action) {
        result.actions.push(applied.action);
      }
      result.error = [
        `Failed to apply triage:${action.verb} #${action.issueNumber}.`,
        applied.message || null,
        applied.error?.stderr_tail || null,
      ].filter(Boolean).join(" ");
      return {
        ...result,
        exitCode: 1,
      };
    }

    result.actions.push(applied.action);
  }

  return {
    ...result,
    exitCode: 0,
  };
}

function main() {
  const wantsJson = process.argv.slice(2).includes("--json");
  const result = execute();
  if (result.error) {
    console.error(result.error);
  } else if (wantsJson) {
    console.log(JSON.stringify({
      report: result.report,
      parsed: result.parsed,
      deduped: result.deduped,
      actions: result.actions.map((action) => ({
        verb: action.verb,
        issueNumber: action.issueNumber,
        args: action.args,
        gh_argv: action.gh_argv,
        result: action.result,
      })),
      skipped: result.skipped,
      apply_mode: result.apply_mode,
    }, null, 2));
  } else {
    process.stdout.write(renderText(result));
  }

  if (result.exitCode !== 0) {
    process.exit(result.exitCode);
  }
}

if (require.main === module) main();

module.exports = {
  ANCHOR_PATTERN,
  CHECKBOX_PATTERN,
  SUPPORTED_VERBS,
  UNKNOWN_PRIORITY_PLACEHOLDER,
  APPLY_CHECKLIST_HEADING,
  assertGitHubAuthority,
  usage,
  parseArgs,
  normalizeArgs,
  stableSerialize,
  buildActionKey,
  parseFrontmatter,
  markdownLiteralLines,
  isApplyChecklistHeading,
  isSetextHeading,
  parseReport,
  outsideChecklistMessage,
  dedupActions,
  validateAcceptedActions,
  formatRevisitComment,
  formatDuplicateComment,
  buildPriorityEditCommand,
  toGhCommands,
  formatGhCommand,
  trimStderr,
  runGh,
  parseGhLabels,
  extractCommandArrays,
  readApplyLog,
  appendLogLine,
  preflightApplyLog,
  buildLogEntry,
  resolveReportDate,
  resolveLogPath,
  readLineSync,
  confirmApply,
  ensureApplyAllowed,
  tryRecordLog,
  logAppendFailure,
  uncertainEffectFailure,
  applyAcceptedAction,
  summarizeResults,
  renderText,
  execute,
};
