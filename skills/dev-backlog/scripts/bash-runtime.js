const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { toPortablePath } = require("./portable-path.js");

function resolveBashExecutable({
  platform = process.platform,
  env = process.env,
  findGit = () => execFileSync("where.exe", ["git"], { encoding: "utf8" }),
  fileExists = fs.existsSync,
} = {}) {
  if (env.DEV_BACKLOG_BASH) return env.DEV_BACKLOG_BASH;
  if (platform !== "win32") return "bash";

  const windowsPath = path.win32;
  const gitExecutables = findGit().split(/\r?\n/).filter(Boolean);
  const candidates = gitExecutables.flatMap((gitExecutable) => {
    const directory = windowsPath.dirname(gitExecutable);
    return [
      windowsPath.join(directory, "bash.exe"),
      windowsPath.resolve(directory, "..", "bin", "bash.exe"),
    ];
  });
  const bash = candidates.find(fileExists);
  if (bash) return bash;
  throw new Error(
    "Git for Windows Bash was not found. Install Git for Windows or set DEV_BACKLOG_BASH."
  );
}

function toBashArgs(args, platform = process.platform) {
  return platform === "win32" ? args.map(toPortablePath) : args;
}

function spawnBashSync(args, options = {}) {
  const env = options.env || process.env;
  return spawnSync(resolveBashExecutable({ env }), toBashArgs(args), options);
}

module.exports = {
  resolveBashExecutable,
  spawnBashSync,
  toBashArgs,
};
