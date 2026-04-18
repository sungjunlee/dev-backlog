#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { readSnapshot } = require("./triage-stale.js");

const ANCHOR_PATTERN = /<!--\s*triage:([\w-]+)\s+#(\d+)(?:\s+(.*?))?\s*-->/;
const DEFAULT_REPORT_DIR = path.join("backlog", "triage");
const DEFERRED_RELATIONSHIPS_MARKER =
  "_(PR-merged edges deferred — requires snapshot v2 `closing_prs`; tracked in #73)_";
const DEFERRED_OBSOLETE_MARKER =
  "_(closing-PR-already-merged and duplicate-of-closed signals deferred — requires snapshot v2; tracked in #73)_";

function usage() {
  return "Usage: triage-report.js --snapshot PATH [--relate PATH] [--stale PATH] [--out PATH] [--json]";
}

function parseArgs(args) {
  const options = {
    snapshotPath: undefined,
    relatePath: undefined,
    stalePath: undefined,
    outPath: undefined,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--snapshot" || arg === "--relate" || arg === "--stale" || arg === "--out") {
      const nextValue = args[index + 1];
      if (!nextValue) {
        return { ...options, error: `Missing value for ${arg}. ${usage()}` };
      }

      if (arg === "--snapshot") options.snapshotPath = nextValue;
      if (arg === "--relate") options.relatePath = nextValue;
      if (arg === "--stale") options.stalePath = nextValue;
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
    if (arg.startsWith("--out=")) {
      options.outPath = arg.slice("--out=".length);
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
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
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

function sortGroupEntries(groups) {
  return [...groups.entries()].sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
}

function renderIssueTable(title, groups) {
  const entries = sortGroupEntries(groups);
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

function renderClassification(snapshot) {
  return [
    "## Classification",
    "By theme, priority label, and activity bucket from the collected snapshot.",
    "",
    renderIssueTable("By Theme", groupBy(snapshot.issues, (issue) => issue.buckets.theme || "uncategorized")),
    "",
    renderIssueTable(
      "By Priority Label",
      groupBy(snapshot.issues, (issue) => issue.buckets.label?.priority || "medium")
    ),
    "",
    renderIssueTable("By Activity", groupBy(snapshot.issues, (issue) => issue.buckets.activity || "unknown")),
  ].join("\n");
}

function formatRelationshipEdge(edge, issueIndex) {
  const fromIssue = issueIndex.get(edge.from);
  const toIssue = issueIndex.get(edge.to);
  const left = fromIssue ? issueRef(fromIssue) : `#${edge.from}`;
  const right = toIssue ? issueRef(toIssue) : `#${edge.to}`;

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
    lines.push("_(no input provided)_", "", DEFERRED_RELATIONSHIPS_MARKER);
    return lines.join("\n");
  }

  if (relate.edges.length === 0) {
    lines.push("_(none)_", "", DEFERRED_RELATIONSHIPS_MARKER);
    return lines.join("\n");
  }

  for (const edge of [...relate.edges].sort((left, right) => left.from - right.from || left.to - right.to || left.kind.localeCompare(right.kind))) {
    lines.push(formatRelationshipEdge(edge, issueIndex));
  }
  lines.push("", DEFERRED_RELATIONSHIPS_MARKER);
  return lines.join("\n");
}

function actionPriority(action) {
  const reason = String(action.summary || "");
  if (/explicit invalid|explicit wontfix/i.test(reason)) return 30;
  if (action.verb === "close-duplicate") return 20;
  if (action.verb === "close") return 10;
  return 0;
}

function dedupeActions(actions) {
  const selected = new Map();

  for (const action of actions) {
    const key = `${action.section}:${action.verb}:${action.issueNumber}`;
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

function staleCandidateToAction(candidate) {
  if (candidate.suggested_action === "close") {
    return {
      section: "obsolete",
      verb: "close",
      issueNumber: candidate.number,
      args: { reason: candidate.reason },
      summary: `Close #${candidate.number} — ${candidate.reason}`,
      evidence: shortText(candidate.reason, 160),
    };
  }

  if (candidate.suggested_action === "revisit") {
    return {
      section: "obsolete",
      verb: "revisit",
      issueNumber: candidate.number,
      args: { reason: candidate.reason },
      summary: `Revisit #${candidate.number} — ${candidate.reason}`,
      evidence: shortText(candidate.reason, 160),
    };
  }

  const mergeMatch = String(candidate.suggested_action || "").match(/^merge-into:(#\d+)$/);
  if (mergeMatch) {
    return {
      section: "obsolete",
      verb: "close-duplicate",
      issueNumber: candidate.number,
      args: { target: mergeMatch[1], reason: candidate.reason },
      summary: `Close duplicate #${candidate.number} into ${mergeMatch[1]} — ${candidate.reason}`,
      evidence: shortText(candidate.reason, 160),
    };
  }

  return null;
}

function buildObsoleteActions(stale) {
  if (!stale) return [];
  return dedupeActions(
    stale.candidates
      .map(staleCandidateToAction)
      .filter(Boolean)
  );
}

function renderActionBlocks(actions) {
  const lines = [];
  for (const action of actions) {
    lines.push(formatAnchor(action));
    lines.push(`- [ ] ${action.summary}`);
    lines.push("");
  }
  return lines;
}

function renderObsoleteCandidates(stale, actions) {
  const lines = ["## Obsolete Candidates"];

  if (!stale) {
    lines.push("_(no input provided)_", "", DEFERRED_OBSOLETE_MARKER);
    return lines.join("\n");
  }

  if (actions.length === 0) {
    lines.push("_(none)_", "", DEFERRED_OBSOLETE_MARKER);
    return lines.join("\n");
  }

  lines.push(...renderActionBlocks(actions));
  if (lines[lines.length - 1] === "") lines.pop();
  lines.push("", DEFERRED_OBSOLETE_MARKER);
  return lines.join("\n");
}

function buildThemeStats(snapshot) {
  const stats = new Map();
  for (const issue of snapshot.issues) {
    const theme = issue.buckets.theme || "uncategorized";
    if (!stats.has(theme)) stats.set(theme, { total: 0, active: 0 });
    const entry = stats.get(theme);
    entry.total += 1;
    if (issue.buckets.activity === "recent" || issue.buckets.activity === "warm") {
      entry.active += 1;
    }
  }
  return stats;
}

function buildRelationshipCounts(relate) {
  const counts = new Map();
  if (!relate) return counts;

  for (const edge of relate.edges) {
    counts.set(edge.from, (counts.get(edge.from) || 0) + 1);
    counts.set(edge.to, (counts.get(edge.to) || 0) + 1);
  }
  return counts;
}

function buildClosedIssueSet(obsoleteActions) {
  return new Set(
    obsoleteActions
      .filter((action) => action.verb === "close" || action.verb === "close-duplicate")
      .map((action) => action.issueNumber)
  );
}

function buildPriorityActions(snapshot, relate, obsoleteActions) {
  const themeStats = buildThemeStats(snapshot);
  const relationshipCounts = buildRelationshipCounts(relate);
  const closedIssues = buildClosedIssueSet(obsoleteActions);
  const actions = [];

  for (const issue of snapshot.issues) {
    if (closedIssues.has(issue.number)) continue;

    const currentPriority = issue.buckets.label?.priority || "medium";
    if (currentPriority === "high" || currentPriority === "critical") continue;

    const theme = issue.buckets.theme || "uncategorized";
    const themeStat = themeStats.get(theme) || { total: 0, active: 0 };
    const relationshipCount = relationshipCounts.get(issue.number) || 0;
    const themeHot = theme !== "uncategorized" && themeStat.active >= 2;
    const relationshipHot = relationshipCount > 0;
    const activityEligible = issue.buckets.activity !== "cold";

    if (!activityEligible) continue;
    if (!themeHot && !relationshipHot) continue;

    const reasons = [];
    if (themeHot) reasons.push(`theme ${theme} has ${themeStat.active} recent/warm issues`);
    if (relationshipHot) reasons.push(`connected by ${relationshipCount} relationship edge${relationshipCount === 1 ? "" : "s"}`);

    actions.push({
      section: "priority",
      verb: "set-priority",
      issueNumber: issue.number,
      args: {
        value: "high",
        reason: reasons.join("; "),
      },
      summary: `Set priority:high on #${issue.number} — ${reasons.join("; ")}`,
      evidence: reasons.join("; "),
    });
  }

  return dedupeActions(actions);
}

function getIsoWeek(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
}

function nextSprintName(generated) {
  const generatedDate = new Date(generated);
  return `Sprint W${getIsoWeek(generatedDate) + 1}`;
}

function buildMilestoneActions(snapshot, relate, obsoleteActions, priorityActions) {
  const relationshipCounts = buildRelationshipCounts(relate);
  const closedIssues = buildClosedIssueSet(obsoleteActions);
  const priorityIssues = new Set(priorityActions.map((action) => action.issueNumber));
  const sprintName = nextSprintName(snapshot.generated);
  const actions = [];

  for (const issue of snapshot.issues) {
    if (closedIssues.has(issue.number)) continue;
    if (issue.milestone !== null && issue.milestone !== undefined) continue;

    const theme = issue.buckets.theme || "uncategorized";
    const relationshipCount = relationshipCounts.get(issue.number) || 0;
    const relationshipHot = relationshipCount > 0;
    const activeTheme = theme !== "uncategorized" && issue.buckets.activity !== "cold";
    const priorityHot = priorityIssues.has(issue.number);

    if (!relationshipHot && !activeTheme && !priorityHot) continue;

    const rationale = [];
    if (activeTheme) rationale.push(`theme ${theme}`);
    if (relationshipHot) rationale.push(`${relationshipCount} relationship edge${relationshipCount === 1 ? "" : "s"}`);
    if (priorityHot) rationale.push("priority proposal above");

    actions.push({
      section: "milestone",
      verb: "assign-milestone",
      issueNumber: issue.number,
      args: {
        name: sprintName,
        cluster: theme,
      },
      cluster: theme,
      sprintName,
      summary: `Assign ${sprintName} to #${issue.number} — ${rationale.join("; ")}`,
      evidence: rationale.join("; "),
    });
  }

  return dedupeActions(actions);
}

function renderPriorityProposals(actions) {
  const lines = [
    "## Priority Proposals",
    "Heuristic: suggest `priority:high` for non-high issues that are still active and either sit in a theme with multiple recent/warm issues or participate in relationship edges.",
  ];

  if (actions.length === 0) {
    lines.push("", "_(none)_");
    return lines.join("\n");
  }

  lines.push("", ...renderActionBlocks(actions));
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
      lines.push(...renderActionBlocks(clusterActions));
      if (lines[lines.length - 1] === "") lines.pop();
      lines.push("");
    }
  }

  if (lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function renderApplyChecklist(actions) {
  const lines = ["## Apply Checklist"];

  if (actions.length === 0) {
    lines.push("_(none)_");
    return lines.join("\n");
  }

  for (const action of actions) {
    const sectionName =
      action.section === "obsolete" ? "Obsolete Candidates" :
      action.section === "priority" ? "Priority Proposals" :
      "Milestone Suggestions";
    lines.push(`- ${action.summary} (${sectionName})`);
  }

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

function buildReportModel({ snapshot, snapshotPath, relate, stale }) {
  const issueIndex = buildIssueIndex(snapshot);
  const obsoleteActions = buildObsoleteActions(stale);
  const priorityActions = buildPriorityActions(snapshot, relate, obsoleteActions);
  const milestoneActions = buildMilestoneActions(snapshot, relate, obsoleteActions, priorityActions);
  const allActions = [...obsoleteActions, ...priorityActions, ...milestoneActions];

  const sections = [
    { key: "classification", title: "Classification", markdown: renderClassification(snapshot) },
    { key: "relationships", title: "Relationships", markdown: renderRelationships(relate, issueIndex) },
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

  return {
    snapshot,
    relate,
    stale,
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

if (require.main === module) main();

module.exports = {
  ANCHOR_PATTERN,
  DEFERRED_RELATIONSHIPS_MARKER,
  DEFERRED_OBSOLETE_MARKER,
  usage,
  parseArgs,
  parseAnchorArgs,
  parseAnchor,
  formatAnchor,
  readJsonFile,
  validateRelateResult,
  validateStaleResult,
  buildObsoleteActions,
  buildPriorityActions,
  buildMilestoneActions,
  buildReportModel,
  renderReport,
  resolveOutputPath,
  writeReportFile,
  loadInputs,
};
