#!/usr/bin/env node
/**
 * Aggregate deterministic dev-backlog health checks into one CI-ready probe.
 * Each check normalizes to one verdict: active-sprint invariant, sprint shape,
 * in-flight trace/staleness, _context.md bloat. Reassess is a human call at
 * sprint close, not a counter (charter rev 19, #446).
 */

const fs = require("fs");
const path = require("path");
const {
  findActiveSprintFiles,
  extractSectionLines,
  hasSection,
  parsePlanItem,
  parseFrontmatter,
  parseSprintContent,
} = require("./sprint-state.js");
const {
  sprintScopeKey,
  scopesOverlap,
  DEFAULT_BACKLOG_DIR,
} = require("./lib.js");
const { repoDisplayPath } = require("./portable-path.js");

const SCHEMA_VERSION = 1;
const DEFAULT_STALE_DAYS = 7;
const CONTEXT_BLOAT_LINE_THRESHOLD = 200;
const REQUIRED_ACTIVE_SECTIONS = ["Goal", "Plan", "Running Context", "Progress"];

function usage() {
  return [
    "Usage: backlog-doctor.js [--json] [--stale-days N] [backlog-dir]",
    "",
    "Runs active-sprint, sprint-shape, in-flight trace/staleness,",
    "and _context.md bloat checks.",
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

  const tracks = loadActiveTracks(sprintsDir);
  const active = checkActiveSprint({ repoRoot: root, sprintsDir, tracks });

  // Per-sprint checks fan out per active track (PRD §5.3): 0 or 1 active keeps
  // today's single untagged run; N>1 runs each check once per track and tags
  // the verdict with that track's slug.
  const trackRuns = tracks.length > 0 ? tracks : [null];
  const perTrack = trackRuns.map((track) => {
    const activePath = track ? track.path : null;
    const tag = tracks.length > 1 ? track : null;
    const sprintState = loadSprintState({ activePath, today });
    return {
      sprint_shape: tagTrack(
        checkSprintShape({ repoRoot: root, activePath, activeStatus: active.status }),
        tag,
      ),
      in_flight_trace: tagTrack(checkInFlightTrace({ sprintState, activeStatus: active.status }), tag),
      in_flight_staleness: tagTrack(
        checkInFlightStaleness({ sprintState, activeStatus: active.status, staleDays }),
        tag,
      ),
    };
  });

  const checks = [
    active,
    ...perTrack.map((run) => run.sprint_shape),
    ...perTrack.map((run) => run.in_flight_trace),
    ...perTrack.map((run) => run.in_flight_staleness),
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

// Active sprint files as track records: path + slug + parsed frontmatter, in
// portfolio order (`started:` ascending per D4, filename as a stable tiebreaker
// — same ordering as sprint-state.js).
function loadActiveTracks(sprintsDir) {
  return findActiveSprintFiles(sprintsDir)
    .map((filePath) => ({
      path: filePath,
      slug: path.basename(filePath, ".md"),
      frontmatter: parseFrontmatter(fs.readFileSync(filePath, "utf-8")),
    }))
    .sort(compareTracks);
}

function compareTracks(a, b) {
  const sa = a.frontmatter.started || "";
  const sb = b.frontmatter.started || "";
  if (sa !== sb) return sa < sb ? -1 : 1;
  return a.path < b.path ? -1 : 1;
}

function firstOverlappingTrackPair(tracks) {
  for (let i = 0; i < tracks.length; i += 1) {
    for (let j = i + 1; j < tracks.length; j += 1) {
      if (scopesOverlap(tracks[i].frontmatter, tracks[j].frontmatter)) {
        return [tracks[i], tracks[j]];
      }
    }
  }
  return null;
}

// N>1 only: tag a per-sprint verdict with the track it belongs to.
function tagTrack(check, track) {
  if (!track) return check;
  return { ...check, track: track.slug };
}

function checkActiveSprint({ repoRoot, sprintsDir, tracks = loadActiveTracks(sprintsDir) }) {
  const sprintFiles = listSprintFiles(sprintsDir);
  const activeFiles = tracks.map((track) => track.path);
  const displayActive = activeFiles.map((file) => displayPath(repoRoot, file));

  if (tracks.length > 1) {
    const overlap = firstOverlappingTrackPair(tracks);
    if (overlap) {
      const [a, b] = overlap;
      return verdict("active_sprint", "fail", {
        summary: `Active tracks overlap on scope: ${displayPath(repoRoot, a.path)} ∩ ${displayPath(repoRoot, b.path)}. Give them disjoint component:/scope: or close one before continuing.`,
        active_files: displayActive,
        overlapping_files: [displayPath(repoRoot, a.path), displayPath(repoRoot, b.path)],
        sprint_count: sprintFiles.length,
        active_path: null,
      });
    }

    const scopeless = tracks.filter((track) => sprintScopeKey(track.frontmatter).kind === "none");
    if (scopeless.length >= 1) {
      // informational: a scopeless track cannot be proven disjoint, but
      // cannot be proven overlapping either.
      const scopelessFiles = scopeless.map((track) => displayPath(repoRoot, track.path));
      return {
        ...verdict("active_sprint", "warn", {
          summary: `${tracks.length} active tracks; cannot prove disjoint. Without component:/scope: (${scopelessFiles.join(", ")}). Declare component: or scope: on every active track.`,
          active_files: displayActive,
          scopeless_files: scopelessFiles,
          sprint_count: sprintFiles.length,
          active_path: null,
        }),
        informational: true,
      };
    }

    return verdict("active_sprint", "pass", {
      summary: `${tracks.length} active tracks, scopes disjoint.`,
      active_files: displayActive,
      sprint_count: sprintFiles.length,
      active_path: null,
    });
  }

  if (activeFiles.length === 0 && sprintFiles.length > 0) {
    // informational: a normal resting state, surfaced as warn for visibility.
    return {
      ...verdict("active_sprint", "warn", {
        summary: `No active sprint found among ${sprintFiles.length} sprint file(s); this is normal between sprints.`,
        active_files: [],
        sprint_count: sprintFiles.length,
        active_path: null,
      }),
      informational: true,
    };
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

// Parse one track's sprint file directly (not via readSprintState, whose
// no-selector read is portfolio-global and fails loud on overlapping tracks;
// the doctor reports overlap itself via the active_sprint verdict).
function loadSprintState({ activePath, today }) {
  if (!activePath) return { state: null, error: null };
  try {
    return {
      state: parseSprintContent({
        sprintPath: activePath,
        content: fs.readFileSync(activePath, "utf-8"),
        today,
      }),
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
      task_ref_grammar: "#N",
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
      summary: `${unmoored.length} unmoored in-flight item(s) lack PR, branch, or run pointers. Repair: append a pointer to the Plan line (PR: → PR #N (state); branch: [branch:name]; run: [run:id]) or revert the item to [ ].`,
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

// Whitelist (order-stable) of the plan-item fields a verdict may publish.
const PUBLIC_PLAN_FIELDS = [
  "line", "tracker", "id", "ref", "issue_number",
  "age_days", "age_source", "age_basis_date", "pr", "branch", "run_id",
];

function publicPlanItem(item) {
  return Object.fromEntries(PUBLIC_PLAN_FIELDS.map((field) => [field, item[field]]));
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
  const lines = report.checks.map((check) => {
    const trackTag = check.track ? ` [${check.track}]` : "";
    return `[${labels[check.status]}] ${check.name}${trackTag} - ${check.detail.summary}`;
  });
  lines.push(`Exit hint: ${report.exit_hint}`);
  return lines.join("\n");
}

function displayPath(repoRoot, filePath) {
  return repoDisplayPath(repoRoot, filePath);
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
  DEFAULT_BACKLOG_DIR,
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
