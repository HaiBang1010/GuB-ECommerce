---
description: End a session/phase — sync docs to what actually got built, then commit.
argument-hint: [optional: what we worked on this session]
allowed-tools: Read, Glob, Grep, Edit, Bash(git log:*), Bash(git diff:*), Bash(git status:*), Bash(git add:*), Bash(git commit:*)
---
## Context
- Recent commits: !`git log --oneline -n 25`
- Uncommitted changes: !`git status --short`
- Diff vs last commit: !`git diff`

## Task
Bring the docs back in line with reality before I close the session. Work in this order:

1. **Always update root phase status — this step is mandatory, even if nothing else drifted.**
   Open the ROOT `ARCHITECTURE.md` §7 (Phases) and update it to match reality:
   - mark finished phases **DONE** (with a one-line note of what that includes),
   - mark the active phase **IN PROGRESS** and list what's done vs. still remaining in it,
   - record any deliberate scope decision (e.g. "CI: skipped — solo/commit-to-main", "deploy: deferred").
   This is the file `/catchup` reads first next session, so it must never be stale.

2. **Detect other drift.** Compare what changed this session ($ARGUMENTS) against the docs. Look for:
   - new/changed Prisma models or fields not reflected in `backend/prisma/schema.prisma` notes,
   - new modules / endpoints / flows / conventions not described,
   - decisions that turned out differently from the plan (the "ACTUAL differs from plan" cases),
   - anything in `CLAUDE.md` (commands, conventions, module list) that's now stale.

3. **Update the docs** that need it — edit only what genuinely changed, and put each change in the RIGHT file:
   - **root `ARCHITECTURE.md`**: phase status (§7, step 1) + any system-wide / cross-cutting change.
   - **`backend/` or `frontend/` `ARCHITECTURE.md`**: layer-specific changes (a module's internals, a backend guard, a frontend route) belong here, NOT in root.
   - **`CLAUDE.md`**: only if a convention / command / boundary actually changed (keep it short).
   - Do NOT pad the docs with speculation about future phases — only record what now exists.

4. **Show me the doc diffs** for approval.

5. After I approve, commit everything (code + docs) with Conventional Commits — group sensibly, and include a `docs(scope):` commit for the doc updates (use `docs(architecture):` for root phase-status edits).

Keep edits surgical. Step 1 always runs; if nothing else drifted, say so and just do step 1 + commit.