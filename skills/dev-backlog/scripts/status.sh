#!/bin/bash
# Quick project status from GitHub + local files
# Usage: bash scripts/status.sh

echo "=== GitHub Issues ==="
gh issue list --state open --json labels --jq '
  [.[] | .labels[].name] |
  reduce .[] as $l ({}; .[$l] += 1) |
  to_entries | map("\(.key): \(.value)") | .[]
' 2>/dev/null || echo "(gh not available — showing local only)"

echo ""
echo "=== Open Issues ==="
gh issue list --state open --limit 20 --json number,title,labels,milestone --jq '
  .[] | "\(.number)\t\(.milestone.title // "-")\t\(.title)\t\([.labels[].name] | join(","))"
' 2>/dev/null | column -t -s $'\t'

echo ""
echo "=== Local Backlog ==="
if [ -d "backlog/tasks" ]; then
  total=$(ls backlog/tasks/*.md 2>/dev/null | wc -l | tr -d ' ')
  todo=$(grep -l "^status: .*To Do" backlog/tasks/*.md 2>/dev/null | wc -l | tr -d ' ')
  inprog=$(grep -l "^status: .*In Progress" backlog/tasks/*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "Local files: $total total, $todo To Do, $inprog In Progress"
else
  echo "No backlog/tasks/ directory"
fi

if [ -d "backlog/completed" ]; then
  done=$(ls backlog/completed/*.md 2>/dev/null | wc -l | tr -d ' ')
  echo "Completed: $done"
fi
