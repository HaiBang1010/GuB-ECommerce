---
description: End a session/phase — sync docs to what actually got built, then commit.
argument-hint: [optional: what we worked on this session]
allowed-tools: Read, Glob, Grep, Edit, Bash(git log:*), Bash(git diff:*), Bash(git status:*), Bash(git add:*), Bash(git commit:*)
---
## Context
- This session's commits: !`git log --oneline main@{1.day.ago}..HEAD`
- Uncommitted changes: !`git status --short`
- Diff vs last commit: !`git diff`

## Task
Bring the docs back in line with reality before I close the session. Work in this order:

1. **Detect drift.** Compare what changed this session ($ARGUMENTS) against the docs. Look specifically for:
   - new/changed Prisma models or fields not reflected in `backend/prisma/schema.prisma` notes in `ARCHITECTURE.md`,
   - new modules/endpoints/flows not described,
   - decisions that turned out differently from the plan (the "ACTUAL differs from plan" cases),
   - anything in `CLAUDE.md` (commands, conventions, module list) that's now stale.

2. **Update the docs** that need it — edit only what genuinely changed:
   - `ARCHITECTURE.md`: update the phase status (mark done), add new flows/models, add an "ACTUAL vs plan" note where they diverged.
   - `backend/` or `frontend/` `ARCHITECTURE.md`: layer-specific changes.
   - `CLAUDE.md`: only if a convention/command/boundary actually changed (keep it short).
   - Do NOT pad the docs with speculation about future phases — only record what now exists.

3. **Show me the doc diffs** for approval.

4. After I approve, commit everything (code + docs) with Conventional Commits — group sensibly, and include a `docs(scope):` commit for the doc updates.

Keep edits surgical. If nothing drifted, say so and just commit.