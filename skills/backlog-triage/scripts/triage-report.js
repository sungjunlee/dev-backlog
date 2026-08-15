#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { readSnapshot } = require("./triage-stale.js");

const ANCHOR_PATTERN = /<!--\s*triage:([\w-]+)\s+#(\d+)(?:\s+(.*?))?\s*-->/;
const DEFAULT_REPORT_DIR = path.join("backlog", "triage");
const OPTIONAL_RELATIONSHIPS_MARKER =
  "_(comment and closing-PR relationship signals run only when snapshot v2 fields are present)_";
const DEFERRED_OBSOLETE_MARKER =
  "_(merged closing-PR signals run only when snapshot v2 fields are present)_";

function usage() {
  return "Usage: triage-report.js --snapshot PATH [--relate PATH] [--stale PATH] [--active-sprint PATH] [--model-actions PATH] [--out PATH] [--json]";
}

function parseArgs(args) {
  const options = {
    snapshotPath: undefined,
    relatePath: undefined,
    stalePath: undefined,
    activeSprintPath: undefined,
    modelActionsPath: undefined,
    outPath: undefined,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--snapshot" || arg === "--relate" || arg === "--stale" || arg === "--model-actions" || arg === "--out") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { ...options, error: `Missing value for ${arg}. ${usage()}` };
      }

      if (arg === "--snapshot") options.snapshotPath = nextValue;
      if (arg === "--relate") options.relatePath = nextValue;
      if (arg === "--stale") options.stalePath = nextValue;
      if (arg === "--model-actions") options.modelActionsPath = nextValue;
      if (arg === "--out") options.outPath = nextValue;
      index += 1;
      continue;
    }

    if (arg.startsWith("--snapshot=")) {
      options.snapshotPath = arg.slice("--snapshot=".length);
      continue;
    }
    if (arg.startsWith("--relate=")) {
      options.relatePath = arg.slice("--relate=".length);
      continue;
    }
    if (arg.startsWith("--stale=")) {
      options.stalePath = arg.slice("--stale=".length);
      continue;
    }
    if (arg.startsWith("--model-actions=")) {
      options.modelActionsPath = arg.slice("--model-actions=".length);
      continue;
    }
    if (arg.startsWith("--out=")) {
      options.outPath = arg.slice("--out=".length);
      continue;
    }
    if (arg === "--active-sprint") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { ...options, error: `Missing value for --active-sprint. ${usage()}` };
      }
      options.activeSprintPath = nextValue;
      index += 1;
      continue;
    }
    if (arg.startsWith("--active-sprint=")) {
      options.activeSprintPath = arg.slice("--active-sprint=".length);
      continue;
    }

    return { ...options, error: `Unknown argument: ${arg}. ${usage()}` };
  }

  if (!options.snapshotPath) {
    return { ...options, error: `Missing required --snapshot PATH. ${usage()}` };
  }

  return options;
}

function readJsonFile(filePath, { label, validate } = {}) {
  const resolvedPath = path.resolve(filePath);
  let raw;
  try {
    raw = fs.readFileSync(resolvedPath, "utf-8");
  } catch (error) {
    throw new Error(`Failed to read ${label || "JSON"} at ${resolvedPath}: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${label || "JSON"} at ${resolvedPath}: ${error.message}`);
  }

  if (typeof validate === "function") {
    return validate(parsed, resolvedPath);
  }

  return parsed;
}

function validateRelateResult(result, resolvedPath) {
  if (!result || typeof result !== "object" || !Array.isArray(result.edges)) {
    throw new Error(`Malformed relate JSON at ${resolvedPath}: expected { edges: [] }.`);
  }
  return result;
}

function validateStaleResult(result, resolvedPath) {
  if (!result || typeof result !== "object" || !Array.isArray(result.candidates)) {
    throw new Error(`Malformed stale JSON at ${resolvedPath}: expected { candidates: [] }.`);
  }
  return result;
}

function parseAnchorArgs(argText) {
  const args = {};
  const source = typeof argText === "string" ? argText.trim() : "";
  if (!source) return args;

  const pattern = /([\w-]+)=(?:"((?:\\"|[^"])*)"|([^\s]+))/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const value = match[2] !== undefined ? match[2].replace(/\\"/g, '"') : match[3];
    args[match[1]] = value;
  }
  return args;
}

function parseAnchor(line) {
  const match = String(line || "").match(ANCHOR_PATTERN);
  if (!match) return null;

  return {
    verb: match[1],
    issueNumber: Number(match[2]),
    argsText: match[3] || "",
    args: parseAnchorArgs(match[3] || ""),
  };
}

function escapeAnchorValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatAnchorArgValue(value) {
  const stringValue = String(value);
  if (/^[A-Za-z0-9._:/#-]+$/.test(stringValue)) return stringValue;
  return `"${escapeAnchorValue(stringValue)}"`;
}

function formatAnchorArgs(args) {
  const entries = Object.entries(args || {}).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (entries.length === 0) return "";
  return entries.map(([key, value]) => `${key}=${formatAnchorArgValue(value)}`).join(" ");
}

function formatAnchor(action) {
  const argsText = formatAnchorArgs(action.args);
  return `<!-- triage:${action.verb} #${action.issueNumber}${argsText ? ` ${argsText}` : ""} -->`;
}

function issueRef(issue) {
  return `#${issue.number} ${issue.title}`;
}

function shortText(text, maxLength = 140) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  const stripped = normalized.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, "");
  const displayText = stripped || normalized;
  if (displayText.length <= maxLength) return displayText;
  return `${displayText.slice(0, maxLength - 1)}…`;
}

function buildIssueIndex(snapshot) {
  return new Map(snapshot.issues.map((issue) => [issue.number, issue]));
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function sortIssues(issues) {
  return [...issues].sort((left, right) => left.number - right.number);
}

function extractMarkdownSection(content, heading) {
  const source = String(content || "");
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^##\\s+${escapedHeading}\\s*$`, "m");
  const match = source.match(pattern);
  if (!match || match.index === undefined) return "";

  const start = match.index + match[0].length;
  const rest = source.slice(start);
  const nextHeading = rest.search(/^##\s+/m);
  return (nextHeading === -1 ? rest : rest.slice(0, nextHeading)).trim();
}

function collectActiveSprintIssueNumbers(content) {
  const protectedNumbers = new Set();
  const sections = [
    extractMarkdownSection(content, "Plan"),
    extractMarkdownSection(content, "Running Context"),
  ];

  for (const section of sections) {
    const pattern = /(^|[^A-Za-z0-9_])#(\d+)\b/g;
    let match;
    while ((match = pattern.exec(section)) !== null) {
      protectedNumbers.add(Number(match[2]));
    }
  }

  return protectedNumbers;
}

function sortGroupEntries(groups, orderHint) {
  const entries = [...groups.entries()];
  if (Array.isArray(orderHint) && orderHint.length > 0) {
    const rank = new Map(orderHint.map((key, index) => [key, index]));
    return entries.sort(([leftKey], [rightKey]) => {
      const leftRank = rank.has(leftKey) ? rank.get(leftKey) : orderHint.length;
      const rightRank = rank.has(rightKey) ? rank.get(rightKey) : orderHint.length;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return leftKey.localeCompare(rightKey);
    });
  }
  return entries.sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
}

function renderIssueTable(title, groups, { orderHint } = {}) {
  const entries = sortGroupEntries(groups, orderHint);
  const lines = [`### ${title}`];
  if (entries.length === 0) {
    lines.push("", "_(none)_");
    return lines.join("\n");
  }

  lines.push("", "| Group | Issues |", "| --- | --- |");
  for (const [group, issues] of entries) {
    const issuesCell = sortIssues(issues)
      .map((issue) => `#${issue.number} ${shortText(issue.title, 48)}`)
      .join("<br>");
    lines.push(`| ${group} | ${issuesCell} |`);
  }
  return lines.join("\n");
}

const AGE_ORDER = ["<7d", "7-30d", "30-90d", ">90d"];

function renderClassification(snapshot) {
  return [
    "## Classification",
    "Grouped by theme / label / age from the collected snapshot.",
    "",
    renderIssueTable("By Theme", groupBy(snapshot.issues, (issue) => issue.buckets.theme || "uncategorized")),
    "",
    renderIssueTable(
      "By Label",
      groupBy(snapshot.issues, (issue) => issue.buckets.label?.type || "uncategorized")
    ),
    "",
    renderIssueTable(
      "By Age",
      groupBy(snapshot.issues, (issue) => issue.buckets.age || "unknown"),
      { orderHint: AGE_ORDER }
    ),
  ].join("\n");
}

function formatRelationshipEdge(edge, issueIndex) {
  const fromIssue = issueIndex.get(edge.from);
  const toIssue = issueIndex.get(edge.to);
  const left = fromIssue ? issueRef(fromIssue) : `#${edge.from}`;
  const right = toIssue ? issueRef(toIssue) : `#${edge.to}`;

  if (edge.kind === "merged-pr-link") {
    const pr = edge.evidence?.pr || {};
    const prLabel = pr.number ? `PR #${pr.number}` : "merged PR";
    const mergedAt = pr.mergedAt ? `; mergedAt ${pr.mergedAt}` : "";
    return `- ${left} merged-pr-link ${prLabel}${mergedAt}`;
  }

  if (edge.kind === "duplicate-candidate") {
    const overlap = Array.isArray(edge.evidence?.overlap) && edge.evidence.overlap.length > 0
      ? `; overlap: ${edge.evidence.overlap.join(", ")}`
      : "";
    return `- ${left} duplicate-candidate ${right} — score ${Number(edge.confidence).toFixed(2)}${overlap}`;
  }

  const evidence = shortText(edge.evidence?.snippet || edge.evidence?.phrase || edge.evidence?.match || "", 140);
  return `- ${left} ${edge.kind} ${right}${evidence ? ` — ${evidence}` : ""}`;
}

function renderRelationships(relate, issueIndex) {
  const lines = ["## Relationships"];

  if (!relate) {
    lines.push("_(no input provided)_", "", OPTIONAL_RELATIONSHIPS_MARKER);
    return lines.join("\n");
  }

  if (relate.edges.length === 0) {
    lines.push("_(none)_", "", OPTIONAL_RELATIONSHIPS_MARKER);
    return lines.join("\n");
  }

  for (const edge of [...relate.edges].sort((left, right) => left.from - right.from || left.to - right.to || left.kind.localeCompare(right.kind))) {
    lines.push(formatRelationshipEdge(edge, issueIndex));
  }
  lines.push("", OPTIONAL_RELATIONSHIPS_MARKER);
  return lines.join("\n");
}

function actionPriority(action) {
  const reason = String(action.summary || "");
  if (/explicit invalid|explicit wontfix/i.test(reason)) return 30;
  if (action.verb === "close-duplicate") return 20;
  if (action.verb === "close") return 10;
  return 0;
}

function normalizeActionKey(action) {
  // Deferred require: triage-apply.js requires this module for ANCHOR_PATTERN,
  // so a top-level require would create a circular dependency at load time.
  const { normalizeArgs, stableSerialize } = require("./triage-apply.js");
  return `${action.verb}|${action.issueNumber}|${stableSerialize(normalizeArgs(action.args))}`;
}

function dedupeActions(actions) {
  const selected = new Map();

  for (const action of actions) {
    const key = normalizeActionKey(action);
    const current = selected.get(key);
    if (!current || actionPriority(action) > actionPriority(current)) {
      selected.set(key, action);
    }
  }

  return [...selected.values()].sort(
    (left, right) =>
      left.issueNumber - right.issueNumber ||
      left.verb.localeCompare(right.verb) ||
      left.summary.localeCompare(right.summary)
  );
}

function formatStaleEvidence(candidate) {
  const ev = candidate.evidence;
  if (!ev || typeof ev !== "object") return "";

  const parts = [];
  if (ev.matchedLabel) parts.push(`label=${ev.matchedLabel}`);
  if (typeof ev.daysSinceUpdate === "number") {
    const threshold = typeof ev.thresholdDays === "number" ? ` (threshold ${ev.thresholdDays}d)` : "";
    parts.push(`${ev.daysSinceUpdate}d since update${threshold}`);
  } else if (ev.updatedAt) {
    parts.push(`updated ${String(ev.updatedAt).slice(0, 10)}`);
  }
  if (ev.pr && typeof ev.pr === "object") {
    const prLabel = ev.pr.number ? `PR #${ev.pr.number}` : "merged PR";
    const mergedAt = ev.pr.mergedAt ? ` merged ${String(ev.pr.mergedAt).slice(0, 10)}` : "";
    parts.push(`${prLabel}${mergedAt}`);
  }
  if (ev.target && typeof ev.target === "object" && Number.isInteger(ev.target.number)) {
    parts.push(`target=#${ev.target.number}`);
  }
  if (typeof ev.score === "number") {
    parts.push(`score=${ev.score.toFixed(2)}`);
  }
  if ("milestone" in ev) {
    parts.push(ev.milestone ? `milestone=${ev.milestone}` : "no milestone");
  }
  if (Array.isArray(ev.labels) && ev.labels.length > 0 && !ev.matchedLabel) {
    parts.push(`labels=${ev.labels.join(",")}`);
  }

  return shortText(parts.join("; "), 160);
}

function staleCandidateToAction(candidate) {
  // triage-stale.js only ever emits suggested_action "close"; revisit and
  // close-duplicate reach the obsolete section through --model-actions.
  if (candidate.suggested_action !== "close") return null;

  return {
    section: "obsolete",
    verb: "close",
    issueNumber: candidate.number,
    args: { reason: candidate.reason },
    summary: `Close #${candidate.number} — ${candidate.reason}`,
    evidence: formatStaleEvidence(candidate),
  };
}

function buildObsoleteActions(stale, { protectedIssueNumbers = new Set() } = {}) {
  if (!stale) return [];
  return dedupeActions(
    stale.candidates
      .map(staleCandidateToAction)
      .filter(Boolean)
      .filter((action) => !protectedIssueNumbers.has(action.issueNumber))
  );
}

function renderActionBlocks(actions, { withEvidence = false } = {}) {
  const lines = [];
  for (const action of actions) {
    lines.push(formatAnchor(action));
    lines.push(`- [ ] ${action.summary}`);
    if (withEvidence && action.evidence) {
      lines.push(`  - _evidence: ${action.evidence}_`);
    }
    lines.push("");
  }
  return lines;
}

function renderObsoleteCandidates(stale, actions) {
  const lines = ["## Obsolete Candidates"];

  if (!stale && actions.length === 0) {
    lines.push("_(no input provided)_", "", DEFERRED_OBSOLETE_MARKER);
    return lines.join("\n");
  }

  if (actions.length === 0) {
    lines.push("_(none)_", "", DEFERRED_OBSOLETE_MARKER);
    return lines.join("\n");
  }

  lines.push(...renderActionBlocks(actions, { withEvidence: true }));
  if (lines[lines.length - 1] === "") lines.pop();
  lines.push("", DEFERRED_OBSOLETE_MARKER);
  return lines.join("\n");
}

function renderPriorityProposals(actions) {
  const lines = [
    "## Priority Proposals",
    "Model judgment: non-high issues worth escalating, with rationale from theme activity, relationship edges, and sprint focus.",
  ];

  if (actions.length === 0) {
    lines.push("", "_(none)_");
    return lines.join("\n");
  }

  lines.push("", ...renderActionBlocks(actions, { withEvidence: true }));
  if (lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function renderMilestoneSuggestions(actions) {
  const lines = ["## Milestone Suggestions"];

  if (actions.length === 0) {
    lines.push("_(none)_");
    return lines.join("\n");
  }

  const bySprint = groupBy(actions, (action) => action.sprintName);
  for (const [sprintName, sprintActions] of sortGroupEntries(bySprint)) {
    lines.push(`### ${sprintName}`);
    const byCluster = groupBy(sprintActions, (action) => action.cluster || "uncategorized");
    for (const [cluster, clusterActions] of sortGroupEntries(byCluster)) {
      lines.push(`Theme cluster: ${cluster}`);
      lines.push("");
      lines.push(...renderActionBlocks(clusterActions, { withEvidence: true }));
      if (lines[lines.length - 1] === "") lines.pop();
      lines.push("");
    }
  }

  if (lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function renderApplyChecklist(actions) {
  const lines = [
    "## Apply Checklist",
    "Consolidated list of every anchored action for scan-and-check review. Flip `[ ]` → `[x]` to accept. The apply step parses the whole report and dedupes — a checkbox in *any* location carrying the anchor accepts the action.",
  ];

  if (actions.length === 0) {
    lines.push("", "_(none)_");
    return lines.join("\n");
  }

  lines.push("");
  for (const action of actions) {
    const sectionName =
      action.section === "obsolete" ? "Obsolete Candidates" :
      action.section === "priority" ? "Priority Proposals" :
      "Milestone Suggestions";
    lines.push(formatAnchor(action));
    lines.push(`- [ ] ${action.summary} _(from ${sectionName})_`);
    lines.push("");
  }
  if (lines[lines.length - 1] === "") lines.pop();

  return lines.join("\n");
}

function buildFrontmatter(snapshot, snapshotPath) {
  const generatedDate = String(snapshot.generated).slice(0, 10);
  return [
    "---",
    `generated: ${generatedDate}`,
    `repo: ${snapshot.repo}`,
    `snapshot: ${snapshotPath}`,
    `open_issues: ${snapshot.issues.length}`,
    "---",
  ].join("\n");
}

function buildReportModel({ snapshot, snapshotPath, relate, stale, activeSprintContent = "", modelActions = [] }) {
  const issueIndex = buildIssueIndex(snapshot);
  const protectedIssueNumbers = collectActiveSprintIssueNumbers(activeSprintContent);

  const modelObsoleteActions = modelActions.filter((action) => action.section === "obsolete");
  const obsoleteActions = dedupeActions([
    ...buildObsoleteActions(stale, { protectedIssueNumbers }),
    ...modelObsoleteActions.filter((action) => !protectedIssueNumbers.has(action.issueNumber)),
  ]);

  const modelRelationships = modelActions.filter((action) => action.section === "relationship");
  const mergedRelate = mergeModelRelationships(relate, modelRelationships);

  const priorityActions = dedupeActions(modelActions.filter((action) => action.section === "priority"));
  const milestoneActions = dedupeActions(modelActions.filter((action) => action.section === "milestone"));
  const allActions = dedupeActions([...obsoleteActions, ...priorityActions, ...milestoneActions]);

  const sections = [
    { key: "classification", title: "Classification", markdown: renderClassification(snapshot) },
    { key: "relationships", title: "Relationships", markdown: renderRelationships(mergedRelate, issueIndex) },
    { key: "obsolete", title: "Obsolete Candidates", markdown: renderObsoleteCandidates(stale, obsoleteActions) },
    { key: "priority", title: "Priority Proposals", markdown: renderPriorityProposals(priorityActions) },
    { key: "milestone", title: "Milestone Suggestions", markdown: renderMilestoneSuggestions(milestoneActions) },
    { key: "apply", title: "Apply Checklist", markdown: renderApplyChecklist(allActions) },
  ];

  const anchors = allActions.map((action) => ({
    section: action.section,
    line: formatAnchor(action),
    ...parseAnchor(formatAnchor(action)),
    summary: action.summary,
  }));

  return {
    frontmatter: buildFrontmatter(snapshot, snapshotPath),
    title: `# Backlog Triage — ${String(snapshot.generated).slice(0, 10)}`,
    sections,
    anchors,
  };
}

function mergeModelRelationships(relate, modelRelationships) {
  if (modelRelationships.length === 0) return relate;

  const base = relate && Array.isArray(relate.edges)
    ? { ...relate, edges: [...relate.edges] }
    : { edges: [] };

  for (const action of modelRelationships) {
    const edge = action.args;
    base.edges.push({
      from: edge.from,
      to: edge.to,
      kind: edge.kind,
      confidence: Number.isFinite(edge.confidence) ? edge.confidence : 1,
      evidence: typeof edge.evidence === "object" && edge.evidence !== null ? edge.evidence : {},
    });
  }

  return base;
}

const MODEL_SECTION_VERBS = Object.freeze({
  priority: new Set(["set-priority"]),
  milestone: new Set(["assign-milestone"]),
  obsolete: new Set(["close", "revisit", "close-duplicate"]),
  relationship: new Set(["edge"]),
});

const MODEL_EDGE_KINDS = new Set([
  "mentions",
  "comment-mentions",
  "blocks",
  "depends-on",
  "duplicate-candidate",
  "merged-pr-link",
]);

function validateModelAction(action, index) {
  const label = `model action[${index}]`;

  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error(`${label} must be an object.`);
  }

  const section = String(action.section || "");
  if (!MODEL_SECTION_VERBS[section]) {
    throw new Error(`${label} has unsupported section "${section}"; expected one of ${Object.keys(MODEL_SECTION_VERBS).join(", ")}.`);
  }

  const verb = String(action.verb || "");
  if (!MODEL_SECTION_VERBS[section].has(verb)) {
    throw new Error(`${label} uses verb "${verb}" which is not allowed in section "${section}".`);
  }

  const args = action.args;
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error(`${label} must carry a plain-object args.`);
  }

  if (section === "relationship") {
    if (!Number.isSafeInteger(args.from) || args.from <= 0 || !Number.isSafeInteger(args.to) || args.to <= 0) {
      throw new Error(`${label} (edge) requires positive safe-integer args.from and args.to.`);
    }
    if (!MODEL_EDGE_KINDS.has(args.kind)) {
      throw new Error(`${label} (edge) has unsupported kind "${args.kind}"; expected one of ${[...MODEL_EDGE_KINDS].join(", ")}.`);
    }
  } else {
    if (!Number.isSafeInteger(action.issueNumber) || action.issueNumber <= 0) {
      throw new Error(`${label} must carry a positive safe-integer issueNumber.`);
    }
  }

  const requiredArgs = section === "priority"
    ? ["value"]
    : section === "milestone"
      ? ["name"]
      : section === "obsolete"
        ? verb === "close-duplicate"
          ? ["target", "reason"]
          : ["reason"]
        : [];

  for (const key of requiredArgs) {
    const value = args[key];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`${label} (${verb}) requires a non-empty string arg "${key}".`);
    }
  }

  if (section === "milestone" && (typeof action.sprintName !== "string" || !action.sprintName.trim())) {
    throw new Error(`${label} (assign-milestone) requires a non-empty string top-level sprintName for grouping.`);
  }
  if (section === "milestone" && action.cluster !== undefined && typeof action.cluster !== "string") {
    throw new Error(`${label} (assign-milestone) top-level cluster, when present, must be a string.`);
  }

  if (!String(action.summary || "").trim()) {
    throw new Error(`${label} must carry a non-empty summary.`);
  }
}

function loadModelActions(modelActionsPath) {
  if (!modelActionsPath) return [];
  const actions = readJsonFile(modelActionsPath, { label: "model actions JSON" });
  if (!Array.isArray(actions)) {
    throw new Error(`Invalid model actions JSON at ${modelActionsPath}: expected an array of action objects.`);
  }

  return actions.map((action, index) => {
    validateModelAction(action, index);
    return {
      section: String(action.section),
      verb: String(action.verb),
      issueNumber: action.section === "relationship" ? undefined : action.issueNumber,
      args: action.args,
      cluster: typeof action.cluster === "string" ? action.cluster : undefined,
      sprintName: typeof action.sprintName === "string" ? action.sprintName : undefined,
      summary: String(action.summary),
      evidence: typeof action.evidence === "string" ? action.evidence : undefined,
    };
  });
}

function renderReport(reportModel) {
  return [
    reportModel.frontmatter,
    "",
    reportModel.title,
    "",
    ...reportModel.sections.flatMap((section, index) => (index === reportModel.sections.length - 1 ? [section.markdown] : [section.markdown, ""])),
    "",
  ].join("\n");
}

function resolveOutputPath(snapshot, explicitOutPath) {
  if (explicitOutPath) return explicitOutPath;
  const generatedDate = String(snapshot.generated).slice(0, 10);
  return path.join(DEFAULT_REPORT_DIR, `${generatedDate}-report.md`);
}

function writeReportFile(outPath, markdown) {
  const resolvedPath = path.resolve(outPath);
  const backupPath = `${resolvedPath}.bak`;
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

  if (fs.existsSync(resolvedPath)) {
    fs.renameSync(resolvedPath, backupPath);
  }

  fs.writeFileSync(resolvedPath, markdown);
  return { path: resolvedPath, backupPath: fs.existsSync(backupPath) ? backupPath : null };
}

function loadInputs(options) {
  const snapshot = readSnapshot(options.snapshotPath);
  const relate = options.relatePath
    ? readJsonFile(options.relatePath, { label: "relate JSON", validate: validateRelateResult })
    : null;
  const stale = options.stalePath
    ? readJsonFile(options.stalePath, { label: "stale JSON", validate: validateStaleResult })
    : null;
  const activeSprintContent = options.activeSprintPath
    ? fs.readFileSync(path.resolve(options.activeSprintPath), "utf-8")
    : "";
  const modelActions = loadModelActions(options.modelActionsPath);

  return {
    snapshot,
    relate,
    stale,
    activeSprintContent,
    modelActions,
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.error) {
    console.error(options.error);
    process.exit(1);
  }

  let inputs;
  let reportModel;
  let markdown;

  try {
    inputs = loadInputs(options);
    reportModel = buildReportModel({
      snapshot: inputs.snapshot,
      snapshotPath: options.snapshotPath,
      relate: inputs.relate,
      stale: inputs.stale,
      activeSprintContent: inputs.activeSprintContent,
      modelActions: inputs.modelActions,
    });
    markdown = renderReport(reportModel);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const outPath = resolveOutputPath(inputs.snapshot, options.outPath);
  writeReportFile(outPath, markdown);

  if (options.json) {
    console.log(JSON.stringify({ sections: reportModel.sections, anchors: reportModel.anchors }, null, 2));
  }
}

module.exports = {
  ANCHOR_PATTERN,
  OPTIONAL_RELATIONSHIPS_MARKER,
  DEFERRED_OBSOLETE_MARKER,
  usage,
  parseArgs,
  parseAnchorArgs,
  parseAnchor,
  formatAnchor,
  readJsonFile,
  validateRelateResult,
  validateStaleResult,
  extractMarkdownSection,
  collectActiveSprintIssueNumbers,
  buildObsoleteActions,
  loadModelActions,
  validateModelAction,
  mergeModelRelationships,
  formatStaleEvidence,
  staleCandidateToAction,
  buildReportModel,
  renderReport,
  resolveOutputPath,
  writeReportFile,
  loadInputs,
};

if (require.main === module) main();
