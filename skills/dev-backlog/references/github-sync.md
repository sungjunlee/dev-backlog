# GitHub Sync Reference

`gh` CLI patterns for syncing GitHub Issues with local backlog files.

## Label Setup (once per repo)

```bash
# Status labels
gh label create "status:todo" -c "e6e6e6" -d "Not yet started"
gh label create "status:in-progress" -c "0075ca" -d "Active work"
gh label create "status:blocked" -c "d73a4a" -d "Waiting on dependency"
gh label create "status:in-review" -c "a2eeef" -d "PR under review"

# Priority labels
gh label create "priority:critical" -c "b60205" -d "Drop everything"
gh label create "priority:high" -c "d93f0b" -d "This sprint"
gh label create "priority:medium" -c "fbca04" -d "Plan for soon"
gh label create "priority:low" -c "0e8a16" -d "Nice to have"

# Type labels
gh label create "type:feature" -c "1d76db"
gh label create "type:bug" -c "d73a4a"
gh label create "type:chore" -c "e4e669"
```

## Creating Issues

```bash
# Simple issue
gh issue create -t "Implement OAuth2" -l "type:feature,priority:high" -m "Sprint W13"

# With body file (for longer descriptions)
gh issue create -t "Title" -F backlog/tasks/draft.md -l "labels" -m "milestone"

# Get the created issue number
gh issue create -t "Title" -l "labels" --json number -q .number
```

## Pulling Issues to Local

```bash
# List open issues as JSON
gh issue list --state open --json number,title,body,labels,milestone,assignees

# View single issue
gh issue view 42 --json number,title,body,labels,milestone,assignees,comments

# Pull all open issues (script pattern)
gh issue list --state open --limit 100 --json number,title,body,labels,milestone,assignees | \
  jq -c '.[]' | while read -r issue; do
    num=$(echo "$issue" | jq -r '.number')
    title=$(echo "$issue" | jq -r '.title')
    # Write to backlog/tasks/{PREFIX}-{num} - {slug}.md
  done
```

## Pushing Updates to GitHub

```bash
# Status change
gh issue edit 42 --add-label "status:in-progress" --remove-label "status:todo"

# Add comment (progress update)
gh issue comment 42 --body "Progress: 3/5 acceptance criteria met"

# Close issue
gh issue close 42 -c "Completed: implemented OAuth2 with JWT"

# Assign to self
gh issue edit 42 --add-assignee @me
```

## Milestone Management

```bash
# Create milestone
gh api repos/{owner}/{repo}/milestones -f title="Sprint W13" -f due_on="2026-03-28T23:59:59Z" -f description="Focus: auth + API"

# List milestones
gh api repos/{owner}/{repo}/milestones --jq '.[] | "\(.number) \(.title) \(.open_issues)/\(.open_issues + .closed_issues)"'

# Assign issue to milestone
gh issue edit 42 --milestone "Sprint W13"

# Close milestone (sprint complete)
gh api repos/{owner}/{repo}/milestones/{milestone_number} -X PATCH -f state="closed"
```

## PR Linking

```bash
# Create PR that auto-closes issue on merge
gh pr create -t "feat(auth): implement OAuth2 (#42)" -b "Fixes #42"

# Check PR status for an issue
gh pr list --search "42" --json number,title,state
```

## Useful Queries

```bash
# Issues in current sprint
gh issue list --milestone "Sprint W13" --json number,title,labels

# Blocked issues
gh issue list --label "status:blocked" --json number,title

# My in-progress issues
gh issue list --assignee @me --label "status:in-progress" --json number,title

# Issues without milestone (unplanned)
gh issue list --state open --json number,title,milestone | jq '[.[] | select(.milestone == null)]'

# Recent comments on an issue
gh issue view 42 --json comments --jq '.comments[-3:][] | "\(.author.login): \(.body[:100])"'
```

## Projects v2 (optional)

If using GitHub Projects for Kanban board:

```bash
# Add issue to project
gh project item-add <PROJECT_NUMBER> --owner @me --url <ISSUE_URL>

# List project items
gh project item-list <PROJECT_NUMBER> --owner @me --format json
```

Most users won't need Projects v2 — milestones + labels are simpler and sufficient for solo/small team work.
