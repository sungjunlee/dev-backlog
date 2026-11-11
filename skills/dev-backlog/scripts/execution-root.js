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
const DIRECTORY_NAMES = new Set(["sprints", "triage"]);

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

function lstatIfPresent(fsApi, target) {
  try {
    return fsApi.lstatSync(target);
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) return null;
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
 * Skill-owned names that the explicit one-time migration may copy+remove.
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
    fsApi.mkdirSync(destPath);
    for (const entry of fsApi.readdirSync(sourcePath)) {
      copyOwned(path.join(sourcePath, entry), path.join(destPath, entry), fsApi);
    }
    return;
  }
  if (stat.isFile()) {
    fsApi.copyFileSync(sourcePath, destPath);
    return;
  }
  throw new Error(`Refusing irregular legacy migration path: ${sourcePath}`);
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
 * `.dev-backlog/`. The caller is responsible for obtaining explicit
 * authorization before invoking this function.
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
  const destStat = lstatIfPresent(fsApi, destRoot);
  if (destStat) {
    if (destStat.isSymbolicLink() || !destStat.isDirectory()) {
      throw new Error(`Refusing unsafe backlog path: ${destRoot} must be a real directory.`);
    }
    return { migrated: false, reason: "destination-exists" };
  }
  const present = skillOwnedNamesForMigration(sourceRoot, fsApi);
  if (present.length === 0) {
    return { migrated: false, reason: "no-legacy-skill-files" };
  }

  const sourceStat = lstatIfPresent(fsApi, sourceRoot);
  if (!sourceStat || sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    throw new Error(`Refusing unsafe legacy backlog path: ${sourceRoot} must be a real directory.`);
  }
  for (const name of present) {
    const sourcePath = path.join(sourceRoot, name);
    const stat = fsApi.lstatSync(sourcePath);
    const kindOk = DIRECTORY_NAMES.has(name) ? stat.isDirectory() : stat.isFile();
    if (stat.isSymbolicLink() || !kindOk) {
      const kind = DIRECTORY_NAMES.has(name) ? "real directory" : "regular file";
      throw new Error(`Refusing unsafe legacy migration path: ${sourcePath} must be a ${kind}.`);
    }
  }

  // Stage every declared input before publishing the destination. A copy or
  // rename failure leaves every original untouched. Once published, the full
  // destination is the recovery copy if removing an original fails midway.
  const stagingRoot = fsApi.mkdtempSync(path.join(cwd, `.${DEFAULT_BACKLOG_DIR}-migration-`));
  try {
    for (const name of present) {
      copyOwned(path.join(sourceRoot, name), path.join(stagingRoot, name), fsApi);
    }
    fsApi.renameSync(stagingRoot, destRoot);
  } catch (error) {
    if (exists(fsApi, stagingRoot)) {
      try {
        fsApi.rmSync(stagingRoot, { recursive: true, force: true });
      } catch {
        // The original error remains primary; the staging path is recoverable.
      }
    }
    throw error;
  }

  for (const name of present) {
    try {
      removeOwned(path.join(sourceRoot, name), fsApi);
    } catch (error) {
      throw new Error(
        `Legacy migration published a complete recovery copy at ${destRoot}, `
        + `but could not remove ${path.join(sourceRoot, name)}.`,
        { cause: error },
      );
    }
  }

  return {
    migrated: true,
    from: LEGACY_EXPORT_DIR,
    to: DEFAULT_BACKLOG_DIR,
    moved: present,
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
