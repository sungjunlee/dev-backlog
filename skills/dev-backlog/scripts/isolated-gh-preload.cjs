/**
 * Smoke-only preload: make `execFileSync("gh")` look like an isolated
 * no-remote failure. Needed because GitHub Actions Windows Node cannot
 * spawn an extensionless `gh` or `gh.cmd` without `shell: true`.
 */
const childProcess = require("node:child_process");
const original = childProcess.execFileSync;

childProcess.execFileSync = function isolatedGhExecFileSync(command, args, options) {
  if (command === "gh") {
    const error = new Error(
      "Command failed: gh\nunable to expand placeholder in path: no git remotes found"
    );
    error.status = 1;
    error.stdout = "";
    error.stderr = "unable to expand placeholder in path: no git remotes found\n";
    throw error;
  }
  return original.call(this, command, args, options);
};
