const ANCHOR_PATTERN = /<!--\s*triage:([\w-]+)\s+#(\d+)(?:\s+(.*?))?\s*-->/;

function parseAnchorArgs(argText) {
  const args = {};
  const source = typeof argText === "string" ? argText.trim() : "";
  if (!source) return args;

  const pattern = /([\w-]+)=(?:"((?:\\"|[^"])*)"|([^\s]+))/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const value = match[2] !== undefined ? match[2].replace(/\\"/g, '"') : match[3];
    args[match[1]] = value;
  }
  return args;
}

function parseAnchor(line) {
  const match = String(line || "").match(ANCHOR_PATTERN);
  if (!match) return null;

  return {
    verb: match[1],
    issueNumber: Number(match[2]),
    argsText: match[3] || "",
    args: parseAnchorArgs(match[3] || ""),
  };
}

module.exports = {
  ANCHOR_PATTERN,
  parseAnchorArgs,
  parseAnchor,
};
