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

// Strict grammar check for the args payload: whitespace-separated key=value or
// key="value" pairs, each key once, nothing left over.
function argSyntaxErrors(argText) {
  const errors = [];
  const source = typeof argText === "string" ? argText.trim() : "";
  const pair = /([\w-]+)=(?:"((?:\\"|[^"])*)"|([^\s"]+))(?=\s|$)/y;
  const seen = new Set();
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    pair.lastIndex = index;
    const match = pair.exec(source);
    if (!match) {
      errors.push(`unparsed argument text ${JSON.stringify(source.slice(index, index + 40))}`);
      break;
    }
    if (seen.has(match[1])) errors.push(`${match[1]} is given more than once`);
    seen.add(match[1]);
    index = pair.lastIndex;
  }
  return errors;
}

function parseAnchor(line) {
  const match = String(line || "").match(ANCHOR_PATTERN);
  if (!match) return null;

  return {
    verb: match[1],
    issueNumber: Number(match[2]),
    argsText: match[3] || "",
    args: parseAnchorArgs(match[3] || ""),
    argErrors: argSyntaxErrors(match[3] || ""),
  };
}

module.exports = {
  ANCHOR_PATTERN,
  parseAnchorArgs,
  argSyntaxErrors,
  parseAnchor,
};
