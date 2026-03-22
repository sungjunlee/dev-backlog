#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# ///
"""Pull open GitHub issues to local backlog/tasks/.

Usage: uv run scripts/sync-pull.py [--prefix PREFIX]
   or: python scripts/sync-pull.py [--prefix PREFIX]
"""

import json
import re
import subprocess
import sys
from pathlib import Path

PREFIX = sys.argv[1] if len(sys.argv) > 1 else "BACK"
TASKS_DIR = Path("backlog/tasks")
TASKS_DIR.mkdir(parents=True, exist_ok=True)


def slugify(text: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-zA-Z0-9]", "-", text)).strip("-")


def get_open_issues() -> list[dict]:
    result = subprocess.run(
        ["gh", "issue", "list", "--state", "open", "--limit", "100",
         "--json", "number,title,body,labels,milestone,assignees"],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"gh error: {result.stderr.strip()}")
        sys.exit(1)
    return json.loads(result.stdout)


def status_from_labels(labels: list[str]) -> str:
    if "status:in-progress" in labels:
        return "In Progress"
    if "status:blocked" in labels:
        return "Blocked"
    if "status:in-review" in labels:
        return "In Review"
    return "To Do"


def priority_from_labels(labels: list[str]) -> str:
    for p in ("critical", "high", "low"):
        if f"priority:{p}" in labels:
            return p
    return "medium"


def write_task_file(issue: dict):
    num = issue["number"]
    title = issue["title"]
    slug = slugify(title)
    filename = f"{PREFIX}-{num} - {slug}.md"
    filepath = TASKS_DIR / filename

    if filepath.exists():
        print(f"  skip: {filename} (exists)")
        return

    label_names = [l["name"] for l in issue.get("labels", [])]
    milestone = (issue.get("milestone") or {}).get("title", "")
    body = issue.get("body") or ""

    status = status_from_labels(label_names)
    priority = priority_from_labels(label_names)

    # Filter out status/priority labels from the labels list
    display_labels = [l for l in label_names
                      if not l.startswith("status:") and not l.startswith("priority:")]

    labels_yaml = "\n".join(f"  - {l}" for l in display_labels) if display_labels else "  []"

    content = f"""---
id: {PREFIX}-{num}
title: "{title}"
status: {status}
labels:
{labels_yaml}
priority: {priority}
milestone: "{milestone}"
created_date: '{subprocess.run(["date", "-u", "+%Y-%m-%d"], capture_output=True, text=True).stdout.strip()}'
---

{body}
""".lstrip()

    filepath.write_text(content)
    print(f"  pull: {filename}")


def main():
    issues = get_open_issues()
    if not issues:
        print("No open issues found.")
        return

    print(f"Found {len(issues)} open issues. Syncing to {TASKS_DIR}/")
    for issue in issues:
        write_task_file(issue)
    print("Done.")


if __name__ == "__main__":
    main()
