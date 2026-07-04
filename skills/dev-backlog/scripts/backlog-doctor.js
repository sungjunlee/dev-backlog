#!/usr/bin/env node
/**
 * Aggregate deterministic dev-backlog health checks into one CI-ready probe.
 *
 * Existing checker modules own their domains; this wrapper normalizes their
 * verdicts and adds active-sprint shape signals for schedulers and close flows.
 */

const fs = require("fs");
const path = require("path");
const {
  findActiveSprintFiles,
  extractSectionLines,
  hasSection,
  parsePlanItem,
  readSprintState,
} = require("./sprint-state.js");
const { checkObjectives } = require("./objectives-check.js");
const {
  lintComponents,
  hasErrors: hasComponentErrors,
} = require("./component-lint.js");
const {
  analyzeCapabilities,
  hasHardFailures: hasCapabilityHardFailures,
} = require("./capabilities-doctor.js");

const SCHEMA_VERSION = 1;
const DEFAULT_BACKLOG_DIR = "backlog";
const DEFAULT_STALE_DAYS = 7;
const DEFAULT_REASSESS_THRESHOLD = 3;
const CONTEXT_BLOAT_LINE_THRESHOLD = 200;
const REQUIRED_ACTIVE_SECTIONS = ["Goal", "Plan", "Running Context", "Progress"];
const REASSESS_REPORT_RE = /^(\d{4}-\d{2}-\d{2})-reassess\.md$/;
const SPRINT_CLOSED_RE = /^-\s+(\d{4}-\d{2}-\d{2})(?:\s+[^:]+)?:\s+Sprint closed\b/;
const SPRINT_FILENAME_MONTH_RE = /^(\d{4}-\d{2})-/;
const REASSESS_ACCOUNTING_RULE = [
  "Counts status: completed sprint files by their final 'Sprint closed' Progress date;",
  "legacy completed sprints without that entry use the filename month as YYYY-MM-01.",
  "A closing sprint passed by sprint-close counts on today's close date for dry-run/pre-close summaries.",
  "Sprints closed on the same day as, or before, the latest reassess report's own date are covered by",
  "that report; only strictly-later close dates count toward the threshold (close times are not",
  "recorded, so same-day ordering against a report cannot be determined).",
].join(" ");

function usage() {
  return [
    "Usage: backlog-doctor.js [--json] [--stale-days N] [--close-summary] [--closing-sprint PATH] [--reassess-threshold N] [backlog-dir]",
    "",
    "Runs active-sprint, objectives, component, capabilities, sprint-shape,",
    "in-flight trace/staleness, and _context.md bloat checks.",
  ].join("\n");
}

function parseArgs(args) {
  const options = {
    backlogDir: DEFAULT_BACKLOG_DIR,
    staleDays: DEFAULT_STALE_DAYS,
    reassessThreshold: DEFAULT_REASSESS_THRESHOLD,
    closeSummary: false,
    closingSprintPath: null,
    json: false,
  };
  let backlogDirSet = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--close-summary") {
      options.closeSummary = true;
      continue;
    }
    if (arg === "--closing-sprint") {
      const next = args[i + 1];
      if (!next) return { ...options, error: `Missing value for --closing-sprint. ${usage()}` };
      options.closingSprintPath = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--closing-sprint=")) {
      options.closingSprintPath = arg.slice("--closing-sprint=".length);
      continue;
    }
    if (arg === "--reassess-threshold") {
      const next = args[i + 1];
      if (!next) return { ...options, error: `Missing value for --reassess-threshold. ${usage()}` };
      const parsed = parseNonNegativeInteger(next, "--reassess-threshold");
      if (parsed.error) return { ...options, error: parsed.error };
      options.reassessThreshold = parsed.value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--reassess-threshold=")) {
      const parsed = parseNonNegativeInteger(
        arg.slice("--reassess-threshold=".length),
        "--reassess-threshold",
      );
      if (parsed.error) return { ...options, error: parsed.error };
      options.reassessThreshold = parsed.value;
      continue;
    }
    if (arg === "--stale-days") {
      const next = args[i + 1];
      if (!next) return { ...options, error: `Missing value for --stale-days. ${usage()}` };
      const parsed = parseStaleDays(next);
      if (parsed.error) return { ...options, error: parsed.error };
      options.staleDays = parsed.value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--stale-days=")) {
      const parsed = parseStaleDays(arg.slice("--stale-days=".length));
      if (parsed.error) return { ...options, error: parsed.error };
      options.staleDays = parsed.value;
      continue;
    }
    if (arg.startsWith("--")) {
      return { ...options, error: `Unknown argument: ${arg}. ${usage()}` };
    }
    if (backlogDirSet) {
      return { ...options, error: `Unexpected argument: ${arg}. ${usage()}` };
    }
    options.backlogDir = arg;
    backlogDirSet = true;
  }

  return options;
}

function parseStaleDays(raw) {
  return parseNonNegativeInteger(raw, "--stale-days");
}

function parseNonNegativeInteger(raw, flagName) {
  if (!/^\d+$/.test(raw)) {
    return { error: `Invalid ${flagName} value: ${raw}. Expected a non-negative integer.` };
  }
  return { value: Number.parseInt(raw, 10) };
}

function runDoctor({
  repoRoot = process.cwd(),
  backlogDir = DEFAULT_BACKLOG_DIR,
  staleDays = DEFAULT_STALE_DAYS,
  today = new Date(),
  contextLineThreshold = CONTEXT_BLOAT_LINE_THRESHOLD,
  reassessThreshold = DEFAULT_REASSESS_THRESHOLD,
  closingSprintPath = null,
} = {}) {
  const root = path.resolve(repoRoot);
  const backlogPath = resolvePath(root, backlogDir);
  const sprintsDir = path.join(backlogPath, "sprints");
  const capabilitiesPath = path.join(root, "spec", "capabilities.md");

  const active = checkActiveSprint({ repoRoot: root, sprintsDir });
  const sprintState = loadSprintState({
    activePath: active.detail.active_path,
    backlogPath,
    today,
  });

  const checks = [
    active,
    checkObjectiveDrift({ repoRoot: root, sprintsDir }),
    checkComponentRouting({ repoRoot: root, sprintsDir, capabilitiesPath }),
    checkCapabilities({ repoRoot: root, capabilitiesPath }),
    checkSprintShape({
      repoRoot: root,
      activePath: active.detail.active_path,
      activeStatus: active.status,
    }),
    checkInFlightTrace({ sprintState, activeStatus: active.status }),
    checkInFlightStaleness({ sprintState, activeStatus: active.status, staleDays }),
    checkContextBloat({ repoRoot: root, sprintsDir, threshold: contextLineThreshold }),
  ];

  // Single accounting function for the reassess signal: both the plain
  // `--json` surface and the `--close-summary` path (via runCloseSummary)
  // flow through this one call, so there is exactly one place that computes
  // "fired or quiet" and why.
  const reassessSignal = buildReassessSignal({
    repoRoot: root,
    backlogDir,
    doctorReport: { checks },
    closingSprintPath,
    today,
    threshold: reassessThreshold,
  });

  return {
    schema_version: SCHEMA_VERSION,
    checks,
    exit_hint: exitHintFor(checks),
    reassess_signal: reassessSignal,
  };
}

function resolvePath(repoRoot, maybeRelative) {
  return path.isAbsolute(maybeRelative) ? maybeRelative : path.join(repoRoot, maybeRelative);
}

function listSprintFiles(sprintsDir) {
  if (!fs.existsSync(sprintsDir)) return [];
  return fs.readdirSync(sprintsDir)
    .filter((file) => file.endsWith(".md") && file !== "_context.md")
    .map((file) => path.join(sprintsDir, file))
    .sort();
}

function checkActiveSprint({ repoRoot, sprintsDir }) {
  const sprintFiles = listSprintFiles(sprintsDir);
  const activeFiles = findActiveSprintFiles(sprintsDir);
  const displayActive = activeFiles.map((file) => displayPath(repoRoot, file));

  if (activeFiles.length > 1) {
    return verdict("active_sprint", "fail", {
      summary: `Multiple active sprint files found (${activeFiles.length}).`,
      active_files: displayActive,
      sprint_count: sprintFiles.length,
      active_path: null,
    });
  }

  if (activeFiles.length === 0 && sprintFiles.length > 0) {
    return verdict("active_sprint", "warn", {
      summary: `No active sprint found among ${sprintFiles.length} sprint file(s); this is normal between sprints.`,
      active_files: [],
      sprint_count: sprintFiles.length,
      active_path: null,
    });
  }

  if (activeFiles.length === 0) {
    return verdict("active_sprint", "pass", {
      summary: "No sprint files found; active sprint invariant has nothing to check.",
      active_files: [],
      sprint_count: 0,
      active_path: null,
    });
  }

  return verdict("active_sprint", "pass", {
    summary: `Exactly one active sprint: ${displayPath(repoRoot, activeFiles[0])}.`,
    active_files: displayActive,
    sprint_count: sprintFiles.length,
    active_path: activeFiles[0],
  });
}

function checkObjectiveDrift({ repoRoot, sprintsDir }) {
  try {
    const result = checkObjectives({ repoRoot, sprintsDir });
    if (!result.charterFound) {
      return verdict("objectives_check", "pass", {
        summary: "No charter found; objective IDs are not enforced.",
        charter_found: false,
        checked_paths: result.checkedPaths.map((file) => displayPath(repoRoot, file)),
      });
    }
    if (result.drift.length > 0) {
      return verdict("objectives_check", "fail", {
        summary: `Detected objective drift in ${result.drift.length} sprint file(s).`,
        charter_found: true,
        charter_path: displayPath(repoRoot, result.charterPath),
        drift: result.drift.map((item) => ({
          ...item,
          sprintFile: displayPath(repoRoot, item.sprintFile),
        })),
      });
    }
    return verdict("objectives_check", "pass", {
      summary: `Checked ${result.sprintCount} sprint file(s) against ${result.charterObjectiveIds.length} charter objective(s).`,
      charter_found: true,
      charter_path: displayPath(repoRoot, result.charterPath),
      sprint_count: result.sprintCount,
    });
  } catch (error) {
    return verdict("objectives_check", "fail", {
      summary: `objectives-check failed: ${error.message}`,
    });
  }
}

function checkComponentRouting({ repoRoot, sprintsDir, capabilitiesPath }) {
  try {
    const result = lintComponents({ sprintsDir, capabilitiesPath });
    if (!result.capabilitiesFound) {
      return verdict("component_lint", "pass", {
        summary: "No spec/capabilities.md found; component handles are not enforced.",
        capabilities_found: false,
        capabilities_path: displayPath(repoRoot, result.capabilitiesPath),
      });
    }
    if (hasComponentErrors(result)) {
      return verdict("component_lint", "fail", {
        summary: `Detected component routing issues in ${result.issues.length} sprint file(s).`,
        capabilities_found: true,
        issues: result.issues.map((issue) => ({
          ...issue,
          sprintFile: displayPath(repoRoot, issue.sprintFile),
        })),
      });
    }
    return verdict("component_lint", "pass", {
      summary: `Checked ${result.checkedSprintCount} sprint file(s); all non-empty component handles resolve.`,
      capabilities_found: true,
      declared_capabilities: result.declaredCapabilities.length,
      routed_sprints: result.routedSprintCount,
      unrouted_sprints: result.unroutedSprintCount,
    });
  } catch (error) {
    return verdict("component_lint", "fail", {
      summary: `component-lint failed: ${error.message}`,
    });
  }
}

function checkCapabilities({ repoRoot, capabilitiesPath }) {
  try {
    const result = analyzeCapabilities({ capabilitiesPath });
    if (!result.found) {
      return verdict("capabilities_doctor", "pass", {
        summary: "No spec/capabilities.md found; capability hygiene is not enforced.",
        found: false,
        capabilities_path: displayPath(repoRoot, result.capabilitiesPath),
      });
    }
    if (hasCapabilityHardFailures(result)) {
      return verdict("capabilities_doctor", "fail", {
        summary: `Capability doctor found ${result.hardFailures.length} hard trigger(s).`,
        found: true,
        hard_failures: result.hardFailures,
        warnings: result.warnings,
      });
    }
    if (result.warnings.length > 0) {
      return verdict("capabilities_doctor", "warn", {
        summary: `Capability doctor found ${result.warnings.length} warning(s).`,
        found: true,
        warnings: result.warnings,
      });
    }
    return verdict("capabilities_doctor", "pass", {
      summary: `Capability spec is within budget (${result.capabilityCount} capability/capabilities, ${result.lineCount} lines).`,
      found: true,
      capability_count: result.capabilityCount,
      line_count: result.lineCount,
    });
  } catch (error) {
    return verdict("capabilities_doctor", "fail", {
      summary: `capabilities-doctor failed: ${error.message}`,
    });
  }
}

function loadSprintState({ activePath, backlogPath, today }) {
  if (!activePath) return { state: null, error: null };
  try {
    return {
      state: readSprintState({ backlogDir: backlogPath, today }),
      error: null,
    };
  } catch (error) {
    return { state: null, error };
  }
}

function checkSprintShape({ repoRoot, activePath, activeStatus }) {
  if (!activePath) {
    const status = activeStatus === "fail" ? "warn" : "pass";
    return verdict("sprint_shape", status, {
      summary: "Skipped sprint shape lint because there is no single active sprint.",
    });
  }

  const content = fs.readFileSync(activePath, "utf-8");
  const missingSections = REQUIRED_ACTIVE_SECTIONS.filter(
    (section) => !hasSection(content, section),
  );
  const unparseable = findUnparseablePlanLines(content);

  if (missingSections.length > 0 || unparseable.length > 0) {
    const parts = [];
    if (missingSections.length > 0) parts.push(`${missingSections.length} missing section(s)`);
    if (unparseable.length > 0) parts.push(`${unparseable.length} unparseable Plan line(s)`);
    return verdict("sprint_shape", "fail", {
      summary: `Active sprint shape violation: ${parts.join("; ")}.`,
      active_sprint: displayPath(repoRoot, activePath),
      required_sections: REQUIRED_ACTIVE_SECTIONS,
      missing_sections: missingSections,
      checkbox_grammar: "^- \\[( |~|x)\\] #\\d+",
      unparseable_plan_lines: unparseable,
    });
  }

  return verdict("sprint_shape", "pass", {
    summary: "Required sections are present and Plan checkbox lines parse.",
    active_sprint: displayPath(repoRoot, activePath),
    required_sections: REQUIRED_ACTIVE_SECTIONS,
  });
}

function findUnparseablePlanLines(content) {
  return extractSectionLines(content, "Plan")
    .map((line, index) => ({ line, plan_line: index + 1 }))
    .filter(({ line }) => line.trim() !== "")
    .filter(({ line }) => !/^###\s+/.test(line))
    .filter(({ line }) => parsePlanItem(line) === null);
}

function checkInFlightTrace({ sprintState, activeStatus }) {
  if (sprintState.error) {
    return verdict("in_flight_trace", activeStatus === "fail" ? "warn" : "fail", {
      summary: `Skipped in-flight trace check: ${sprintState.error.message}`,
    });
  }
  if (!sprintState.state || !sprintState.state.active_sprint) {
    return verdict("in_flight_trace", "pass", {
      summary: "No active sprint; no in-flight trace pointers to check.",
    });
  }

  const unmoored = sprintState.state.in_flight.filter((item) => item.unmoored);
  if (unmoored.length > 0) {
    return verdict("in_flight_trace", "warn", {
      summary: `${unmoored.length} unmoored in-flight item(s) lack PR, branch, or run pointers.`,
      items: unmoored.map(publicPlanItem),
    });
  }

  return verdict("in_flight_trace", "pass", {
    summary: "All in-flight items have PR, branch, or run pointers.",
    in_flight_count: sprintState.state.in_flight.length,
  });
}

function checkInFlightStaleness({ sprintState, activeStatus, staleDays }) {
  if (sprintState.error) {
    return verdict("in_flight_staleness", activeStatus === "fail" ? "warn" : "fail", {
      summary: `Skipped in-flight staleness check: ${sprintState.error.message}`,
      stale_days: staleDays,
    });
  }
  if (!sprintState.state || !sprintState.state.active_sprint) {
    return verdict("in_flight_staleness", "pass", {
      summary: "No active sprint; no in-flight age to check.",
      stale_days: staleDays,
    });
  }

  const stale = sprintState.state.in_flight
    .filter((item) => item.age_days !== null && item.age_days > staleDays);
  if (stale.length > 0) {
    return verdict("in_flight_staleness", "warn", {
      summary: `${stale.length} in-flight item(s) are older than ${staleDays} day(s).`,
      stale_days: staleDays,
      items: stale.map(publicPlanItem),
    });
  }

  return verdict("in_flight_staleness", "pass", {
    summary: `No in-flight items are older than ${staleDays} day(s).`,
    stale_days: staleDays,
    in_flight_count: sprintState.state.in_flight.length,
  });
}

function checkContextBloat({ repoRoot, sprintsDir, threshold }) {
  const contextPath = path.join(sprintsDir, "_context.md");
  if (!fs.existsSync(contextPath)) {
    return verdict("context_bloat", "pass", {
      summary: "_context.md is absent; no cross-sprint context bloat detected.",
      threshold_lines: threshold,
      line_count: 0,
    });
  }

  const content = fs.readFileSync(contextPath, "utf-8");
  const lineCount = countLines(content);
  if (lineCount > threshold) {
    return verdict("context_bloat", "warn", {
      summary: `_context.md is ${lineCount} lines, above the ${threshold}-line bloat threshold.`,
      context_path: displayPath(repoRoot, contextPath),
      threshold_lines: threshold,
      line_count: lineCount,
    });
  }

  return verdict("context_bloat", "pass", {
    summary: `_context.md is within the ${threshold}-line bloat threshold.`,
    context_path: displayPath(repoRoot, contextPath),
    threshold_lines: threshold,
    line_count: lineCount,
  });
}

function runCloseSummary({
  repoRoot = process.cwd(),
  backlogDir = DEFAULT_BACKLOG_DIR,
  staleDays = DEFAULT_STALE_DAYS,
  today = new Date(),
  contextLineThreshold = CONTEXT_BLOAT_LINE_THRESHOLD,
  reassessThreshold = DEFAULT_REASSESS_THRESHOLD,
  closingSprintPath = null,
} = {}) {
  // Thin wrapper: runDoctor already computes reassess_signal via the single
  // buildReassessSignal accounting function, counting the closing sprint on
  // today's date when closingSprintPath is supplied.
  const report = runDoctor({
    repoRoot,
    backlogDir,
    staleDays,
    today,
    contextLineThreshold,
    reassessThreshold,
    closingSprintPath,
  });
  return { doctor_report: report };
}

function buildReassessSignal({
  repoRoot = process.cwd(),
  backlogDir = DEFAULT_BACKLOG_DIR,
  doctorReport,
  closingSprintPath = null,
  today = new Date(),
  threshold = DEFAULT_REASSESS_THRESHOLD,
} = {}) {
  if (!doctorReport) {
    throw new Error("buildReassessSignal requires a doctorReport");
  }

  const root = path.resolve(repoRoot);
  const backlogPath = resolvePath(root, backlogDir);
  const sprintsDir = path.join(backlogPath, "sprints");
  const triageDir = path.join(backlogPath, "triage");
  const latestReassess = findLatestReassessReport({ repoRoot: root, triageDir });
  const completedRecords = collectCompletedSprintRecords({ repoRoot: root, sprintsDir });
  const records = maybeAddClosingSprintRecord({
    repoRoot: root,
    records: completedRecords,
    closingSprintPath,
    today,
  });

  // Same-day rule: a sprint closed on the same day as (or before) the latest
  // reassess report's own filename date is treated as covered by that
  // report. Only strictly-later close dates count toward the threshold --
  // close timestamps are not recorded (Progress entries are date-only), so
  // same-day ordering against the report can't be determined; erring quiet
  // is correct here because doctor warnings still fire independently.
  const countedRecords = latestReassess
    ? records.filter((record) => record.accounting_date > latestReassess.date)
    : records;

  const doctorWarnCount = doctorReport.checks.filter((check) => check.status === "warn").length;
  const doctorFailCount = doctorReport.checks.filter((check) => check.status === "fail").length;
  const doctorSignal = doctorWarnCount > 0 || doctorFailCount > 0;
  const sprintCountSignal = countedRecords.length >= threshold;

  const reason = [
    doctorSignal
      ? `doctor emitted ${doctorWarnCount} ${plural("warning", doctorWarnCount)} and ${doctorFailCount} ${plural("failure", doctorFailCount)}`
      : "doctor clean",
    sprintCountSignal
      ? `${countedRecords.length} ${plural("sprint", countedRecords.length)} closed since last reassess (threshold ${threshold})`
      : `${countedRecords.length}/${threshold} sprint(s) closed since last reassess`,
  ].join("; ");

  return {
    fired: doctorSignal || sprintCountSignal,
    reason,
    sprints_since_last_report: countedRecords.length,
    latest_report: latestReassess ? latestReassess.display_path : null,
    threshold,
    doctor_warn_count: doctorWarnCount,
    doctor_fail_count: doctorFailCount,
    sprint_paths: countedRecords.map((record) => record.display_path),
    accounting_rule: REASSESS_ACCOUNTING_RULE,
  };
}

function findLatestReassessReport({ repoRoot, triageDir }) {
  if (!fs.existsSync(triageDir)) return null;
  const matches = fs.readdirSync(triageDir)
    .map((file) => ({ file, match: file.match(REASSESS_REPORT_RE) }))
    .filter((entry) => entry.match)
    .map((entry) => ({
      date: entry.match[1],
      path: path.join(triageDir, entry.file),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const latest = matches[matches.length - 1];
  if (!latest) return null;
  return {
    ...latest,
    display_path: displayPath(repoRoot, latest.path),
  };
}

function collectCompletedSprintRecords({ repoRoot, sprintsDir }) {
  return listSprintFiles(sprintsDir)
    .map((filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      if (!/^status:\s*completed\s*$/m.test(content)) return null;
      return sprintAccountingRecord({ repoRoot, filePath, content });
    })
    .filter(Boolean);
}

function maybeAddClosingSprintRecord({ repoRoot, records, closingSprintPath, today }) {
  if (!closingSprintPath) return records;
  const resolved = resolvePath(repoRoot, closingSprintPath);
  if (!fs.existsSync(resolved)) return records;
  if (records.some((record) => record.path === resolved)) return records;

  return [
    ...records,
    {
      path: resolved,
      display_path: displayPath(repoRoot, resolved),
      accounting_date: formatLocalDate(today),
      accounting_source: "closing_sprint",
    },
  ];
}

function sprintAccountingRecord({ repoRoot, filePath, content }) {
  const progressDate = finalSprintClosedProgressDate(content);
  const fallbackDate = filenameMonthDate(filePath);
  const accountingDate = progressDate || fallbackDate;
  if (!accountingDate) return null;

  return {
    path: filePath,
    display_path: displayPath(repoRoot, filePath),
    accounting_date: accountingDate,
    accounting_source: progressDate ? "progress" : "filename_month",
  };
}

function finalSprintClosedProgressDate(content) {
  const dates = content.split(/\r?\n/)
    .map((line) => {
      const match = line.match(SPRINT_CLOSED_RE);
      return match ? match[1] : null;
    })
    .filter(Boolean);
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

function filenameMonthDate(filePath) {
  const match = path.basename(filePath).match(SPRINT_FILENAME_MONTH_RE);
  return match ? `${match[1]}-01` : null;
}

function formatLocalDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function plural(noun, count) {
  return count === 1 ? noun : `${noun}s`;
}

function countLines(content) {
  if (content === "") return 0;
  return content.split(/\r?\n/).length;
}

function publicPlanItem(item) {
  return {
    line: item.line,
    issue_number: item.issue_number,
    age_days: item.age_days,
    age_source: item.age_source,
    age_basis_date: item.age_basis_date,
    pr: item.pr,
    branch: item.branch,
    run_id: item.run_id,
  };
}

function verdict(name, status, detail) {
  return { name, status, detail };
}

function exitHintFor(checks) {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warn")) return "warn";
  return "pass";
}

function exitCodeFor(report) {
  return report.exit_hint === "fail" ? 1 : 0;
}

function formatHumanSummary(report) {
  const labels = { pass: "PASS", warn: "WARN", fail: "FAIL" };
  const lines = report.checks.map((check) => (
    `[${labels[check.status]}] ${check.name} - ${check.detail.summary}`
  ));
  lines.push(`Exit hint: ${report.exit_hint}`);
  lines.push(
    `Reassess signal: ${report.reassess_signal.fired ? "fired" : "quiet"} - ${report.reassess_signal.reason}`,
  );
  return lines.join("\n");
}

function formatCloseSummary(result) {
  return [
    "=== Backlog Doctor (pre-close) ===",
    formatHumanSummary(result.doctor_report),
    `Accounting rule: ${result.doctor_report.reassess_signal.accounting_rule}`,
  ].join("\n");
}

function displayPath(repoRoot, filePath) {
  const relative = path.relative(repoRoot, filePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return relative;
  return filePath;
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.error) {
    console.error(parsed.error);
    process.exit(1);
  }
  if (parsed.help) {
    console.log(usage());
    return;
  }

  if (parsed.closeSummary) {
    const result = runCloseSummary(parsed);
    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatCloseSummary(result));
    }
    process.exitCode = exitCodeFor(result.doctor_report);
    return;
  }

  const report = runDoctor(parsed);
  if (parsed.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatHumanSummary(report));
  }
  process.exitCode = exitCodeFor(report);
}

if (require.main === module) main();

module.exports = {
  SCHEMA_VERSION,
  DEFAULT_STALE_DAYS,
  DEFAULT_REASSESS_THRESHOLD,
  CONTEXT_BLOAT_LINE_THRESHOLD,
  REQUIRED_ACTIVE_SECTIONS,
  REASSESS_ACCOUNTING_RULE,
  parseArgs,
  runDoctor,
  runCloseSummary,
  buildReassessSignal,
  exitCodeFor,
  formatHumanSummary,
  formatCloseSummary,
  checkActiveSprint,
  checkSprintShape,
  findUnparseablePlanLines,
  findLatestReassessReport,
  collectCompletedSprintRecords,
  finalSprintClosedProgressDate,
  filenameMonthDate,
};
