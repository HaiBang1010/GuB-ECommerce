---
description: Trace how a feature/request flows across modules end to end (read-only).
argument-hint: [feature, e.g. "checkout" or "guest cart merge"]
allowed-tools: Read, Glob, Grep
---
Trace the flow of **$ARGUMENTS** through the codebase. Read-only — do not edit anything.

Produce:
1. **Entry point(s):** route/controller + the DTO.
2. **Service call chain** across modules, in order, marking each module boundary crossed — confirm data crosses via service calls / scalar ids, never a cross-schema JOIN.
3. **Prisma models/tables** touched and any transaction boundaries.
4. **Side effects:** queue events, Stripe calls, notifications, stock changes.
5. **Invariants** that must hold here (stock atomicity, price snapshot, webhook idempotency, stock release on failure) and exactly where each is enforced.
6. **Gaps / risks** you notice.

Use Grep/Glob to find the real code and cite `file:line`. Don't guess — if something isn't implemented yet, say so.
