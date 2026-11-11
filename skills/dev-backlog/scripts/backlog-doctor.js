#!/usr/bin/env node
/**
 * Aggregate deterministic dev-backlog health checks into one CI-ready probe.
 * Each check normalizes to one verdict: active-sprint invariant, sprint shape,
 * in-flight trace. Reassess is a human call at sprint close, not a counter
 * (charter rev 19, #446).
 */

const fs = require("fs");
const path = require("path");
const {
  hasSection,
  findUnparseablePlanLines,
  readActiveTracks,
} = require("./sprint-state.js");
const {
  sprintScopeKey,
  DEFAULT_BACKLOG_DIR,
} = require("./lib.js");
const { repoDisplayPath } = require("./portable-path.js");

const SCHEMA_VERSION = 1;
const REQUIRED_ACTIVE_SECTIONS = ["Goal", "Plan", "Running Context", "Progress"];

function usage() {
  return [
    "Usage: backlog-doctor.js [--json] [backlog-dir]",
    "",
    "Runs active-sprint, sprint-shape, and in-flight trace checks.",
  ].join("\n");
}

function parseArgs(args) {
  const options = {
    backlogDir: DEFAULT_BACKLOG_DIR,
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

function runDoctor({
  repoRoot = process.cwd(),
  backlogDir = DEFAULT_BACKLOG_DIR,
} = {}) {
  const root = path.resolve(repoRoot);
  const backlogPath = resolvePath(root, backlogDir);
  const sprintsDir = path.join(backlogPath, "sprints");

  const portfolio = readActiveTracks(sprintsDir);
  const tracks = portfolio.tracks;
  const active = checkActiveSprint({
    repoRoot: root,
    sprintsDir,
    tracks,
    overlap: portfolio.overlap,
  });

  // Per-sprint checks fan out per active track (PRD §5.3): 0 or 1 active keeps
  // today's single untagged run; N>1 runs each check once per track and tags
  // the verdict with that track's slug.
  const trackRuns = tracks.length > 0 ? tracks : [null];
  const perTrack = trackRuns.map((track) => {
    const tag = tracks.length > 1 ? track : null;
    return {
      sprint_shape: tagTrack(
        checkSprintShape({ repoRoot: root, track, activeStatus: active.status }),
        tag,
      ),
      in_flight_trace: tagTrack(checkInFlightTrace({ track, activeStatus: active.status }), tag),
    };
  });

  const checks = [
    active,
    ...perTrack.map((run) => run.sprint_shape),
    ...perTrack.map((run) => run.in_flight_trace),
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
    .filter((filePath) => {
      try {
        return fs.statSync(filePath).isFile();
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    })
    .sort();
}

// N>1 only: tag a per-sprint verdict with the track it belongs to.
function tagTrack(check, track) {
  if (!track) return check;
  return { ...check, track: track.slug };
}

function checkActiveSprint({ repoRoot, sprintsDir, tracks, overlap = null }) {
  const portfolio = tracks ? { tracks, overlap } : readActiveTracks(sprintsDir);
  const activeTracks = portfolio.tracks;
  const sprintFiles = listSprintFiles(sprintsDir);
  const activeFiles = activeTracks.map((track) => track.path);
  const displayActive = activeFiles.map((file) => displayPath(repoRoot, file));

  if (activeTracks.length > 1) {
    if (portfolio.overlap) {
      const [a, b] = portfolio.overlap;
      return verdict("active_sprint", "fail", {
        summary: `Active tracks overlap on scope: ${displayPath(repoRoot, a.path)} ∩ ${displayPath(repoRoot, b.path)}. Give them disjoint component:/scope: or close one before continuing.`,
        active_files: displayActive,
        overlapping_files: [displayPath(repoRoot, a.path), displayPath(repoRoot, b.path)],
        sprint_count: sprintFiles.length,
        active_path: null,
      });
    }

    const unprovable = activeTracks.filter((track) => {
      const key = sprintScopeKey(track.frontmatter);
      return key.kind === "none" || key.kind === "unknown" || key.unknown;
    });
    const kinds = new Set(activeTracks.map((track) => sprintScopeKey(track.frontmatter).kind));
    if (unprovable.length > 0 || (kinds.has("component") && kinds.has("scope"))) {
      const scopelessFiles = activeTracks
        .filter((track) => sprintScopeKey(track.frontmatter).kind === "none")
        .map((track) => displayPath(repoRoot, track.path));
      return {
        ...verdict("active_sprint", "warn", {
          summary: `${activeTracks.length} active tracks; cannot prove disjoint: ${displayActive.join(", ")}. Check scope axes and supported directory prefixes.`,
          active_files: displayActive,
          scopeless_files: scopelessFiles,
          sprint_count: sprintFiles.length,
          active_path: null,
        }),
        informational: true,
      };
    }

    return verdict("active_sprint", "pass", {
      summary: `${activeTracks.length} active tracks, scopes disjoint.`,
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

function checkSprintShape({ repoRoot, track, activeStatus }) {
  if (!track) {
    const status = activeStatus === "fail" ? "warn" : "pass";
    return verdict("sprint_shape", status, {
      summary: "Skipped sprint shape lint because there is no single active sprint.",
    });
  }

  const activePath = track.path;
  const content = track.content;
  const missingSections = REQUIRED_ACTIVE_SECTIONS.filter(
    (section) => !hasSection(content, section),
  );
  const unparseable = track.error?.code === "INVALID_ACTIVE_PLAN"
    ? track.error.plan_lines
    : findUnparseablePlanLines(content);

  if (missingSections.length > 0 || unparseable.length > 0) {
    const parts = [];
    if (missingSections.length > 0) parts.push(`${missingSections.length} missing section(s)`);
    if (unparseable.length > 0) parts.push(`${unparseable.length} unparseable Plan line(s)`);
    const repair = unparseable.length > 0
      ? ` Repair: correct the source Plan at ${unparseable.map(({ line_number: lineNumber }) => `${displayPath(repoRoot, activePath)}:${lineNumber}`).join(", ")}; do not continue from a partial or normalized projection.`
      : "";
    return verdict("sprint_shape", "fail", {
      summary: `Active sprint shape violation: ${parts.join("; ")}.${repair}`,
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

function checkInFlightTrace({ track, activeStatus }) {
  if (track?.error) {
    return verdict("in_flight_trace", activeStatus === "fail" ? "warn" : "fail", {
      summary: `Skipped in-flight trace check: ${track.error.message}`,
    });
  }
  if (!track?.track) {
    return verdict("in_flight_trace", "pass", {
      summary: "No active sprint; no in-flight trace pointers to check.",
    });
  }

  const unmoored = track.track.in_flight.filter((item) => item.pointer === null);
  if (unmoored.length > 0) {
    return verdict("in_flight_trace", "warn", {
      summary: `${unmoored.length} unmoored in-flight item(s) lack PR or branch pointers. Repair: append a pointer to the Plan line (PR: → PR #N (state); branch: [branch:name]) or revert the item to [ ].`,
      items: unmoored.map(publicPlanItem),
    });
  }

  return verdict("in_flight_trace", "pass", {
    summary: "All in-flight items have PR or branch pointers.",
    in_flight_count: track.track.in_flight.length,
  });
}

// Whitelist (order-stable) of the plan-item fields a verdict may publish.
const PUBLIC_PLAN_FIELDS = ["ref", "state", "title", "pointer"];

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
  REQUIRED_ACTIVE_SECTIONS,
  parseArgs,
  runDoctor,
  exitCodeFor,
  formatHumanSummary,
  checkActiveSprint,
  checkSprintShape,
  findUnparseablePlanLines,
};
