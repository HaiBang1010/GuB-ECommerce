---
description: Stage changes and create Conventional Commit(s) with clear messages.
allowed-tools: Bash(git add:*), Bash(git commit:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---
## Context
- Status: !`git status --short`
- Staged diff: !`git diff --cached`
- Unstaged diff: !`git diff`
- Recent commits: !`git log --oneline -10`

## Task
Create one or more commits for the current changes.
- Group related changes; never mix unrelated concerns in one commit.
- Use Conventional Commits: `feat|fix|chore|refactor|docs|test(scope): summary`.
  Scope = module or area (e.g. `order`, `cart`, `frontend`, `prisma`).
- Imperative mood, lowercase summary, no trailing period, ≤ 72 chars.
- If nothing is staged, stage the relevant files **by path** yourself, then commit. Never `git add -A` blindly.
- Never commit `.env` or secrets.

If the change set is large, show me the proposed commit message(s) before committing.
