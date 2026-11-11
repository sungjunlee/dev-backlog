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

module.exports = {
  repoDisplayPath,
  toPortablePath,
};
