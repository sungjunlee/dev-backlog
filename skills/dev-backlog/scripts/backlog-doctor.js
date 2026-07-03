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
const CONTEXT_BLOAT_LINE_THRESHOLD = 200;
const REQUIRED_ACTIVE_SECTIONS = ["Goal", "Plan", "Running Context", "Progress"];

function usage() {
  return [
    "Usage: backlog-doctor.js [--json] [--stale-days N] [backlog-dir]",
    "",
    "Runs active-sprint, objectives, component, capabilities, sprint-shape,",
    "in-flight trace/staleness, and _context.md bloat checks.",
  ].join("\n");
}

function parseArgs(args) {
  const options = {
    backlogDir: DEFAULT_BACKLOG_DIR,
    staleDays: DEFAULT_STALE_DAYS,
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
  if (!/^\d+$/.test(raw)) {
    return { error: `Invalid --stale-days value: ${raw}. Expected a non-negative integer.` };
  }
  return { value: Number.parseInt(raw, 10) };
}

function runDoctor({
  repoRoot = process.cwd(),
  backlogDir = DEFAULT_BACKLOG_DIR,
  staleDays = DEFAULT_STALE_DAYS,
  today = new Date(),
  contextLineThreshold = CONTEXT_BLOAT_LINE_THRESHOLD,
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

  return {
    schema_version: SCHEMA_VERSION,
    checks,
    exit_hint: exitHintFor(checks),
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
    return verdict("active_sprint", "fail", {
      summary: `No active sprint found among ${sprintFiles.length} sprint file(s).`,
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
  return lines.join("\n");
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
  CONTEXT_BLOAT_LINE_THRESHOLD,
  REQUIRED_ACTIVE_SECTIONS,
  parseArgs,
  runDoctor,
  exitCodeFor,
  formatHumanSummary,
  checkActiveSprint,
  checkSprintShape,
  findUnparseablePlanLines,
};
