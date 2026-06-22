---
description: Warm up a new session — figure out where the project stands, then plan.
argument-hint: [optional focus, e.g. "phase 2" or "checkout"]
allowed-tools: Read, Glob, Grep, Bash(git log:*), Bash(git status:*)
---
## Context
- Recent commits: !`git log --oneline -20`
- Working tree: !`git status --short`
- Current branch: !`git branch --show-current`

## Task
Get oriented before we do anything. Do NOT write code yet.

1. Read `CLAUDE.md` and `ARCHITECTURE.md` (root), plus the relevant `backend/` or `frontend/` docs for the area in focus.
2. From the docs' phase list (ARCHITECTURE.md §7) and the recent commits, tell me concisely:
   - which phase we're in and what's already done,
   - what the next phase/task requires,
   - any open question or known gap that affects it.
3. Cross-check docs against reality: if a recent commit contradicts what a doc says, flag the drift (don't fix it now).
4. Then propose a short plan for: **$ARGUMENTS** (if empty, for the next logical task).

Keep it tight — a status read + a plan, nothing more. Wait for my approval before coding.