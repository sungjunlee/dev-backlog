/**
 * Skill execution root. One directory, not Backlog.md's leftover `backlog/`
 * tree.
 *
 * LEGACY_EXPORT_DIR is the leftover `backlog/` tree (not an active skill
 * root). It is not skill execution authority.
 */

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_BACKLOG_DIR = ".dev-backlog";
const LEGACY_EXPORT_DIR = "backlog";
const SKILL_OWNED_NAMES = Object.freeze([
  "sprints",
  "config.yml",
  "triage",
  "triage-config.yml",
]);

function defaultSprintsDir(pathApi = path) {
  return pathApi.join(DEFAULT_BACKLOG_DIR, "sprints");
}

function defaultTriageDir(pathApi = path) {
  return pathApi.join(DEFAULT_BACKLOG_DIR, "triage");
}

function exists(fsApi, target) {
  try {
    fsApi.lstatSync(target);
    return true;
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return false;
    throw error;
  }
}

function listPresentSkillNames(sourceDir, fsApi = fs) {
  return SKILL_OWNED_NAMES.filter((name) => exists(fsApi, path.join(sourceDir, name)));
}

function hasSkillLayoutMarkers(names) {
  return names.some((name) => name !== "config.yml");
}

/**
 * Skill-owned names that auto-migrate may copy+remove.
 *
 * `config.yml` migrates only when another skill marker (`sprints`, `triage`,
 * or `triage-config.yml`) is present. A lone `config.yml` is left under
 * `backlog/` (Backlog.md or ambiguous). Never includes `tasks/`, `docs/`,
 * `completed/`, or a parked `.tracker`.
 */
function skillOwnedNamesForMigration(sourceDir, fsApi = fs) {
  const present = listPresentSkillNames(sourceDir, fsApi);
  if (!hasSkillLayoutMarkers(present)) return [];
  return present;
}

function copyOwned(sourcePath, destPath, fsApi) {
  const stat = fsApi.lstatSync(sourcePath);
  if (stat.isDirectory()) {
    if (typeof fsApi.cpSync === "function") {
      fsApi.cpSync(sourcePath, destPath, { recursive: true });
      return;
    }
    fsApi.mkdirSync(destPath, { recursive: true });
    for (const entry of fsApi.readdirSync(sourcePath)) {
      copyOwned(path.join(sourcePath, entry), path.join(destPath, entry), fsApi);
    }
    return;
  }
  fsApi.copyFileSync(sourcePath, destPath);
}

function removeOwned(targetPath, fsApi) {
  const stat = fsApi.lstatSync(targetPath);
  if (stat.isDirectory()) {
    fsApi.rmSync(targetPath, { recursive: true, force: true });
    return;
  }
  fsApi.unlinkSync(targetPath);
}

/**
 * One-shot copy+remove of leftover skill files from `backlog/` into
 * `.dev-backlog/`. Not git mv; no backup; not atomic.
 *
 * Runs only when the destination root is absent and at least one skill-owned
 * name exists under `backlog/`. If `.dev-backlog/` already exists, skips
 * (`destination-exists`) and does not retry — leftovers stay where they are and
 * are not a second active root. Does not touch `backlog/tasks`, `docs`,
 * or `completed`. `config.yml` moves only with a skill layout marker. A
 * leftover `.tracker` is parked, not skill-owned: it stays where it is.
 */
function migrateLegacyExecutionRoot(cwd, { fs: fsApi = fs } = {}) {
  const destRoot = path.join(cwd, DEFAULT_BACKLOG_DIR);
  const sourceRoot = path.join(cwd, LEGACY_EXPORT_DIR);
  if (exists(fsApi, destRoot)) {
    return { migrated: false, reason: "destination-exists" };
  }
  const present = skillOwnedNamesForMigration(sourceRoot, fsApi);
  if (present.length === 0) {
    return { migrated: false, reason: "no-legacy-skill-files" };
  }

  fsApi.mkdirSync(destRoot);
  const copied = [];
  try {
    for (const name of present) {
      copyOwned(path.join(sourceRoot, name), path.join(destRoot, name), fsApi);
      copied.push(name);
    }
    for (const name of copied) {
      removeOwned(path.join(sourceRoot, name), fsApi);
    }
  } catch (error) {
    throw error;
  }

  return {
    migrated: true,
    from: LEGACY_EXPORT_DIR,
    to: DEFAULT_BACKLOG_DIR,
    moved: copied,
  };
}

function leftoverSkillFiles(cwd, { fs: fsApi = fs } = {}) {
  return skillOwnedNamesForMigration(path.join(cwd, LEGACY_EXPORT_DIR), fsApi);
}

module.exports = {
  DEFAULT_BACKLOG_DIR,
  LEGACY_EXPORT_DIR,
  defaultSprintsDir,
  defaultTriageDir,
  leftoverSkillFiles,
  migrateLegacyExecutionRoot,
};
