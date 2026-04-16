const fs = require("fs");
const path = require("path");

function normalizeRelayField(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || trimmed === "unknown" || trimmed === "null") return null;
    return trimmed;
  }
  return value;
}

function parseFrontmatterScalar(value) {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return JSON.parse(value);
  }
  return value;
}

function parseFrontmatter(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") {
    return {};
  }

  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex === -1) {
    throw new Error("Invalid relay manifest: missing closing frontmatter marker");
  }

  const frontmatterLines = lines.slice(1, closingIndex);

  function parseBlock(startIndex, indent) {
    const data = {};
    let index = startIndex;

    while (index < frontmatterLines.length) {
      const raw = frontmatterLines[index];
      if (!raw.trim()) {
        index++;
        continue;
      }

      const currentIndent = raw.match(/^ */)[0].length;
      if (currentIndent < indent) break;
      if (currentIndent > indent) {
        throw new Error(`Invalid relay manifest indentation on line ${index + 2}`);
      }

      const trimmed = raw.trim();
      const separator = trimmed.indexOf(":");
      if (separator === -1) {
        throw new Error(`Invalid relay manifest entry on line ${index + 2}`);
      }

      const key = trimmed.slice(0, separator).trim();
      const rest = trimmed.slice(separator + 1).trim();

      if (!rest) {
        const nested = parseBlock(index + 1, indent + 2);
        data[key] = nested.data;
        index = nested.index;
        continue;
      }

      data[key] = parseFrontmatterScalar(rest);
      index++;
    }

    return { data, index };
  }

  return parseBlock(0, 0).data;
}

function relayEventsPath(relayManifestPath, runId) {
  return path.join(path.dirname(relayManifestPath), runId, "events.jsonl");
}

function readRelayManifestMetadata(relayManifestPath) {
  const resolved = path.resolve(relayManifestPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Relay manifest not found: ${resolved}`);
  }

  const text = fs.readFileSync(resolved, "utf-8");
  const data = parseFrontmatter(text);
  const runId = normalizeRelayField(data.run_id) || path.basename(resolved, path.extname(resolved));

  return {
    manifestPath: resolved,
    runId,
    state: normalizeRelayField(data.state),
    nextAction: normalizeRelayField(data.next_action),
    issueNumber: Number.isFinite(data.issue?.number) ? data.issue.number : null,
    prNumber: Number.isFinite(data.git?.pr_number) ? data.git.pr_number : null,
    executor: normalizeRelayField(data.roles?.executor),
    reviewer: normalizeRelayField(data.roles?.reviewer),
    actor: normalizeRelayField(data.roles?.actor) || normalizeRelayField(data.roles?.orchestrator),
    rounds: Number.isFinite(data.review?.rounds) ? data.review.rounds : null,
  };
}

function readRelayGrade(eventsPath) {
  if (!fs.existsSync(eventsPath)) return null;

  let grade = null;
  const lines = fs.readFileSync(eventsPath, "utf-8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const record = JSON.parse(line);
    if (record.event === "rubric_quality" && typeof record.grade === "string" && record.grade.trim()) {
      grade = record.grade.trim();
    }
  }

  return grade;
}

function loadRelayMetadata(relayManifestPath) {
  if (!relayManifestPath) return null;

  const metadata = readRelayManifestMetadata(relayManifestPath);
  return {
    ...metadata,
    eventsPath: relayEventsPath(metadata.manifestPath, metadata.runId),
    grade: readRelayGrade(relayEventsPath(metadata.manifestPath, metadata.runId)),
  };
}

module.exports = {
  readRelayManifestMetadata,
  readRelayGrade,
  loadRelayMetadata,
};
