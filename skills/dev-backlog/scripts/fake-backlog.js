/**
 * Fake `backlog` executable script used by files tracker tests.
 *
 * The script is written to a temp bin/ directory by fake-backlog-fixture.js and
 * invoked through node. It records every argv line to FAKE_BACKLOG_LOG (jsonl)
 * and keeps task state in FAKE_BACKLOG_STATE (json). State is only ever written
 * after a successful simulated call — a failing call appends to the log but
 * never mutates state.
 *
 * Failure injection (set FAKE_BACKLOG_FAIL in the environment):
 *   probe-error   every call exits 1, stderr "backlog unavailable"
 */

const BACKLOG_SCRIPT = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const statePath = process.env.FAKE_BACKLOG_STATE;
const logPath = process.env.FAKE_BACKLOG_LOG;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
fs.appendFileSync(logPath, JSON.stringify(args) + "\\n");

if (process.env.FAKE_BACKLOG_FAIL === "probe-error") {
  process.stderr.write("backlog unavailable\\n");
  process.exit(1);
}

const prefix = state.prefix || "BACK";
const save = () => fs.writeFileSync(statePath, JSON.stringify(state));
const out = (value) => process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
const has = (flag) => args.includes(flag);
const valuesAfter = (flag) => {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === flag && args[i + 1] !== undefined) {
      values.push(args[i + 1]);
      i += 1;
    }
  }
  return values;
};
const valueAfter = (flag) => {
  const values = valuesAfter(flag);
  return values.length ? values[values.length - 1] : undefined;
};
const canonicalId = (raw) => {
  const text = String(raw);
  const head = prefix + "-";
  return text.slice(0, head.length).toUpperCase() === head.toUpperCase() ? text : head + text;
};
const numericId = (raw) => {
  const text = String(raw);
  const head = prefix + "-";
  return text.slice(0, head.length).toUpperCase() === head.toUpperCase()
    ? text.slice(head.length)
    : text;
};
const findTask = (raw) => {
  const wanted = canonicalId(raw);
  return state.tasks.find((task) => canonicalId(task.id) === wanted);
};
const compact = (task) => ({
  id: canonicalId(task.id),
  title: task.title,
  status: task.status,
  type: task.type || "task",
  priority: task.priority || null,
  assignees: task.assignees || [],
  reporter: task.reporter || null,
  labels: task.labels || [],
  milestone: task.milestone || null,
  parentTaskId: task.parentTaskId || null,
  ordinal: task.ordinal || null,
  createdAt: task.createdAt || null,
  updatedAt: task.updatedAt || null,
});
const full = (task) => ({
  ...compact(task),
  path: task.path || null,
  description: task.description || "",
  dependencies: task.dependencies || [],
  references: task.references || [],
  documentation: task.documentation || [],
  modifiedFiles: task.modifiedFiles || [],
  subtasks: task.subtasks || [],
  acceptanceCriteria: task.acceptanceCriteria || [],
  definitionOfDone: task.definitionOfDone || [],
  implementationPlan: task.implementationPlan || "",
  implementationNotes: task.implementationNotes || "",
  comments: task.comments || [],
  finalSummary: task.finalSummary || "",
});

if (args[0] !== "task") {
  process.stderr.write("unhandled fake backlog argv: " + JSON.stringify(args) + "\\n");
  process.exit(93);
}

if (args[1] === "list") {
  if (!has("--json")) {
    process.stderr.write("unhandled fake backlog argv: " + JSON.stringify(args) + "\\n");
    process.exit(93);
  }
  let tasks = state.tasks.slice();
  const status = valueAfter("--status") || valueAfter("-s");
  if (status) tasks = tasks.filter((task) => task.status === status);
  const limit = valueAfter("--limit");
  if (limit) tasks = tasks.slice(0, Number(limit));
  out({ schemaVersion: 1, kind: "task-list", tasks: tasks.map(compact) });
  process.exit(0);
}

if (args[1] === "view" || (args[1] && !["list", "create", "edit", "archive"].includes(args[1]))) {
  if (!has("--json")) {
    process.stderr.write("unhandled fake backlog argv: " + JSON.stringify(args) + "\\n");
    process.exit(93);
  }
  const rawId = args[1] === "view" ? args[2] : args[1];
  const task = findTask(rawId);
  if (!task) process.exit(4);
  out({ schemaVersion: 1, kind: "task-view", task: full(task) });
  process.exit(0);
}

if (args[1] === "create") {
  const title = args[2];
  if (!title || title.startsWith("-")) {
    process.stderr.write("fake backlog: create requires a title\\n");
    process.exit(1);
  }
  const idNum = state.nextId++;
  const id = prefix + "-" + idNum;
  const description = valueAfter("-d") || valueAfter("--desc") || "";
  const status = valueAfter("-s") || valueAfter("--status") || "To Do";
  const acceptanceCriteria = valuesAfter("--ac").map((text, index) => ({
    index: index + 1, text, checked: false,
  }));
  const task = {
    id, title, description, status,
    labels: [], assignees: [], acceptanceCriteria, comments: [],
    createdAt: "2026-09-15", updatedAt: "2026-09-15",
  };
  state.tasks.push(task);
  save();
  if (has("--json")) {
    out({ schemaVersion: 1, kind: "task-view", task: full(task) });
  } else {
    out("Created task " + id + "\\n");
  }
  process.exit(0);
}

if (args[1] === "edit") {
  const task = findTask(args[2]);
  if (!task) process.exit(4);
  const title = valueAfter("-t") || valueAfter("--title");
  if (title !== undefined) task.title = title;
  const description = valueAfter("-d") || valueAfter("--desc");
  if (description !== undefined) task.description = description;
  const status = valueAfter("-s") || valueAfter("--status");
  if (status !== undefined) task.status = status;
  const ac = valuesAfter("--ac");
  if (ac.length) {
    task.acceptanceCriteria = ac.map((text, index) => ({
      index: index + 1, text, checked: false,
    }));
  }
  const comment = valueAfter("--comment");
  if (comment !== undefined) {
    task.comments = task.comments || [];
    task.comments.push({
      index: task.comments.length + 1,
      body: comment,
      createdAt: "2026-09-15",
      author: valueAfter("--comment-author") || null,
    });
  }
  task.updatedAt = "2026-09-15";
  save();
  process.exit(0);
}

process.stderr.write("unhandled fake backlog argv: " + JSON.stringify(args) + "\\n");
process.exit(93);
`;

module.exports = { BACKLOG_SCRIPT };
