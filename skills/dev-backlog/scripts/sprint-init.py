#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Generate a sprint file skeleton from a GitHub milestone.

Usage: ./scripts/sprint-init.py "auth-system"
       ./scripts/sprint-init.py "auth-system" --milestone "Sprint W13"

First arg is the topic name. Milestone defaults to topic if not specified.
Filename: YYYY-MM-<topic>.md
"""

import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

if len(sys.argv) < 2:
    print('Usage: sprint-init.py "topic" [--milestone "Milestone Name"]')
    sys.exit(1)

TOPIC = sys.argv[1]
MILESTONE = TOPIC
if "--milestone" in sys.argv:
    idx = sys.argv.index("--milestone")
    if idx + 1 < len(sys.argv):
        MILESTONE = sys.argv[idx + 1]

SPRINTS_DIR = Path("backlog/sprints")
SPRINTS_DIR.mkdir(parents=True, exist_ok=True)
TODAY = date.today()
DATE_PREFIX = TODAY.strftime("%Y-%m")


def slugify(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-zA-Z0-9]", "-", text)).strip("-").lower()


def get_milestone_due() -> str:
    result = subprocess.run(
        ["gh", "api", "repos/{owner}/{repo}/milestones",
         "--jq", f'.[] | select(.title=="{MILESTONE}") | .due_on'],
        capture_output=True, text=True
    )
    due = result.stdout.strip()
    return due[:10] if due else "TBD"


def get_milestone_issues() -> list[dict]:
    result = subprocess.run(
        ["gh", "issue", "list", "--milestone", MILESTONE, "--state", "open",
         "--json", "number,title,labels"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        return []
    return json.loads(result.stdout)


def estimate_size(labels: list[str]) -> str:
    """Guess time estimate from labels. Fallback to empty."""
    for l in labels:
        if "bug" in l:
            return "~30min"
        if "chore" in l:
            return "~15min"
    return ""


def main():
    topic_slug = slugify(TOPIC)
    filepath = SPRINTS_DIR / f"{DATE_PREFIX}-{topic_slug}.md"

    if filepath.exists():
        print(f"Sprint file already exists: {filepath}")
        sys.exit(1)

    due = get_milestone_due()
    issues = get_milestone_issues()

    if not issues:
        print(f"No open issues found for milestone: {MILESTONE}")
        print("Create the milestone and assign issues first, or add issues manually.")

    # Build issue lines with optional time estimates
    issue_lines = []
    for issue in issues:
        num = issue["number"]
        title = issue["title"]
        label_names = [l["name"] for l in issue.get("labels", [])]
        est = estimate_size(label_names)
        suffix = f" ({est})" if est else ""
        issue_lines.append(f"- [ ] #{num} {title}{suffix}")

    issues_block = "\n".join(issue_lines) if issue_lines else "- [ ] (add issues here)"

    content = f"""---
milestone: {MILESTONE}
status: active
started: {TODAY.isoformat()}
due: {due}
---

# {TOPIC}

## Goal
[One sentence: what's true when this sprint is done]

## Plan
[Order into batches. Group small tasks (~30min or less) for one session.]

{issues_block}

## Running Context
[Decisions and discoveries that carry across tasks in this sprint]

## Progress
[Timestamped log — update at end of each session/batch]
"""

    filepath.write_text(content)
    print(f"Created: {filepath}\n")
    print(content)


if __name__ == "__main__":
    main()
