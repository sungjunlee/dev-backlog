#!/bin/bash
# Bootstrap backlog/ directory for a new project.
#
# Usage: bash scripts/init.sh [project-name]
#        project-name defaults to the current directory name.
#
# Creates:
#   backlog/sprints/
#   backlog/tasks/
#   backlog/completed/
#   backlog/config.yml

PROJECT_NAME="${1:-$(basename "$(pwd)")}"

if [ -d "backlog" ]; then
  echo "backlog/ already exists. Nothing to do."
  exit 0
fi

mkdir -p backlog/{sprints,tasks,completed}

cat > backlog/config.yml << EOF
project_name: "$PROJECT_NAME"
default_status: "To Do"
statuses: ["To Do", "In Progress", "Done"]
task_prefix: "BACK"
labels: []
milestones: []
auto_commit: false
EOF

echo "Created backlog/ structure:"
echo "  backlog/sprints/     ← Sprint execution files"
echo "  backlog/tasks/       ← GitHub issue mirror"
echo "  backlog/completed/   ← Archived done tasks"
echo "  backlog/config.yml   ← Project config (prefix: BACK)"
echo ""
echo "Next steps:"
echo "  1. Set up GitHub labels: see references/github-sync.md"
echo "  2. Pull issues: node scripts/sync-pull.js"
echo "  3. Plan a sprint: node scripts/sprint-init.js \"topic\""
