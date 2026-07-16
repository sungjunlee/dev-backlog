const path = require("node:path");

function toPortablePath(value) {
  return String(value).replace(/\\/g, "/");
}

function repoDisplayPath(repoRoot, filePath, pathApi = path) {
  const relative = pathApi.relative(repoRoot, filePath);
  if (relative && !relative.startsWith("..") && !pathApi.isAbsolute(relative)) {
    return toPortablePath(relative);
  }
  return filePath;
}

function configDisplayPath(backlogDir, filename = "config.yml", pathApi = path) {
  const value = pathApi.join(backlogDir, filename);
  return pathApi.isAbsolute(value) ? value : toPortablePath(value);
}

module.exports = {
  configDisplayPath,
  repoDisplayPath,
  toPortablePath,
};
