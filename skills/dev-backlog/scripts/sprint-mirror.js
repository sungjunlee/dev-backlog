#!/usr/bin/env node
/**
 * Publish the single active sprint to a machine-managed GitHub issue.
 *
 * Usage: node scripts/sprint-mirror.js [backlog-dir] [--dry-run] [--json]
 *
 * This is the option-(c) half of the SSOT decision (spec/charter.md,
 * Decision row 2026-07-03): the local sprint file stays canonical and is
 * committed at explicit boundaries; this script publishes a read-only
 * GitHub issue mirror of it for shared visibility. Sync is always explicit
 * — there is no daemon and nothing runs this automatically.
 *
 * sprint-state.js is the single owner of sprint markdown parsing. This
 * script never reads sprint files itself — it shells out to sprint-state.js
 * (`--mode status`) and renders its JSON. If sprint-state.js reports no
 * active sprint, or fails because multiple sprints are active, this script
 * refuses rather than guessing.
 */

const { execFileSync } = require("child_process");
const path = require("path");
const { readConfig } = require("./lib.js");
const { parseTaskRef, renderTaskRef } = require("./task-ref.js");
const {
  invokeCapability,
  resolveConfiguredTracker,
  writeTrackerCliError,
} = require("./tracker.js");
const {
  findMirrorIssue,
  createMirrorIssue,
  updateMirrorIssue,
} = require("./github-mirrors.js");

const MARKER_PREFIX = "<!-- dev-backlog:sprint-mirror sprint=";
const MARKER_SUFFIX = " -->";
const SPRINT_STATE_PATH = path.join(__dirname, "sprint-state.js");
const DEFAULT_BACKLOG_DIR = "backlog";

function usage() {
  return "Usage: sprint-mirror.js [backlog-dir] [--dry-run] [--json]";
}

function makeMarker(slug) {
  return `${MARKER_PREFIX}${slug}${MARKER_SUFFIX}`;
}

// --- Args ---

function parseArgs(args) {
  const options = { backlogDir: DEFAULT_BACKLOG_DIR, dryRun: false, json: false };
  let backlogDirSet = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") return { ...options, help: true };
    if (arg === "--dry-run") { options.dryRun = true; continue; }
    if (arg === "--json") { options.json = true; continue; }
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

// --- Resolve execution state via sprint-state.js ---

function resolveSprintState({
  backlogDir = DEFAULT_BACKLOG_DIR,
  execFile = execFileSync,
  sprintStatePath = SPRINT_STATE_PATH,
} = {}) {
  let out;
  try {
    out = execFile(
      process.execPath,
      [sprintStatePath, "--mode", "status", backlogDir],
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    throw new Error(`sprint-state.js failed — refusing to guess active sprint:\n${detail}`);
  }

  let state;
  try {
    state = JSON.parse(out);
  } catch (error) {
    throw new Error(`sprint-state.js produced invalid JSON: ${error.message}`);
  }

  if (state.schema_version !== 1) {
    throw new Error(`Unsupported sprint-state schema_version: ${state.schema_version}`);
  }

  if (!state.active_sprint) {
    throw new Error("No active sprint found. sprint-mirror requires exactly one active sprint.");
  }

  return state;
}

// --- Rendering ---

function formatPointer(item) {
  if (item.pr) return ` — PR #${item.pr.number} (${item.pr.state})`;
  if (item.run_id) return ` — run:${item.run_id}`;
  if (item.branch) return ` — branch ${item.branch}`;
  if (item.unmoored) return " — (unmoored)";
  return "";
}

function formatPlanItem(item) {
  const title = item.title ? ` ${item.title}` : "";
  const identity = item.tracker
    ? item
    : parseTaskRef(`#${item.issue_number}`);
  return `- [${item.checkbox_state}] ${renderTaskRef(identity)}${title}${formatPointer(item)}`;
}

function renderPlanSection(planItems) {
  if (!planItems || planItems.length === 0) {
    return ["_No plan items._"];
  }

  const lines = [];
  let currentBatch;
  for (const item of planItems) {
    if (item.batch_heading && item.batch_heading !== currentBatch) {
      if (currentBatch !== undefined) lines.push("");
      lines.push(item.batch_heading);
      currentBatch = item.batch_heading;
    }
    lines.push(formatPlanItem(item));
  }
  return lines;
}

function renderProgressSection(latestProgress) {
  if (!latestProgress || latestProgress.length === 0) {
    return ["_No progress recorded yet._"];
  }
  return latestProgress.map((entry) => entry.line);
}

function renderMirrorBody({ state, slug, now = new Date() }) {
  const marker = makeMarker(slug);
  const lines = [marker, ""];

  lines.push(
    "> The local sprint file is canonical. This mirror is read-only — it is",
    "> not edited by hand — and sync is always explicit; there is no daemon.",
    ""
  );

  lines.push("## Goal", "");
  lines.push(state.active_sprint.goal || "_No goal recorded._");
  lines.push("");

  lines.push("## Plan", "");
  lines.push(...renderPlanSection(state.plan_items));
  lines.push("");

  lines.push("## Latest Progress", "");
  lines.push(...renderProgressSection(state.latest_progress));
  lines.push("");

  lines.push(`Last explicit sync: ${now.toISOString()}`);

  return lines.join("\n");
}

// --- Core sync ---

function sync({
  backlogDir = DEFAULT_BACKLOG_DIR,
  dryRun = false,
  now = new Date(),
  execFile = execFileSync,
  sprintStatePath = SPRINT_STATE_PATH,
} = {}) {
  const resolved = resolveConfiguredTracker(readConfig(backlogDir), { execFile });
  invokeCapability(resolved, "mirrors", () => undefined);
  const state = resolveSprintState({ backlogDir, execFile, sprintStatePath });
  const slug = path.basename(state.active_sprint.path, ".md");
  const marker = makeMarker(slug);
  const title = `Sprint mirror: ${slug}`;
  const body = renderMirrorBody({ state, slug, now });

  const existing = findMirrorIssue(marker, execFile);

  if (dryRun) {
    return {
      action: "dry-run",
      issue_number: existing ? existing.number : null,
      sprint: slug,
      marker,
      body,
    };
  }

  if (existing) {
    updateMirrorIssue(existing.number, body, execFile);
    return { action: "updated", issue_number: existing.number, sprint: slug, marker, body };
  }

  const created = createMirrorIssue(title, body, execFile);
  return { action: "created", issue_number: created.number, sprint: slug, marker, body };
}

// --- Output ---

function printResult(result) {
  if (result.action === "dry-run") {
    const verb = result.issue_number ? "update" : "create";
    const ref = result.issue_number ? ` #${result.issue_number}` : "";
    console.log(`[dry-run] Would ${verb}${ref} mirror for sprint ${result.sprint} (${result.marker})`);
    console.log("");
    console.log(result.body);
    return;
  }

  if (result.action === "created") {
    console.log(`Created sprint mirror issue #${result.issue_number} for ${result.sprint}.`);
  } else {
    console.log(`Updated sprint mirror issue #${result.issue_number} for ${result.sprint}.`);
  }
}

// --- CLI ---

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

  try {
    const result = sync({ backlogDir: parsed.backlogDir, dryRun: parsed.dryRun });

    if (parsed.json) {
      console.log(JSON.stringify({
        action: result.action,
        issue_number: result.issue_number,
        sprint: result.sprint,
        marker: result.marker,
      }, null, 2));
      return;
    }

    printResult(result);
  } catch (error) {
    if (writeTrackerCliError(error, { json: parsed.json })) {
      process.exit(1);
    }
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = {
  usage,
  makeMarker,
  parseArgs,
  resolveSprintState,
  formatPointer,
  formatPlanItem,
  renderPlanSection,
  renderProgressSection,
  renderMirrorBody,
  findMirrorIssue,
  createMirrorIssue,
  updateMirrorIssue,
  sync,
  printResult,
};
