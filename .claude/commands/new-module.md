---
description: Scaffold a new NestJS module following GuB architecture conventions.
argument-hint: [module-name]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash(npx prisma:*)
---
Scaffold a new backend module named `$1` under `backend/src/modules/$1/`.

Follow CLAUDE.md and backend/CLAUDE.md:
- Files: `$1.module.ts`, `$1.controller.ts`, `$1.service.ts`, `dto/`, `$1.service.spec.ts`.
- Business logic lives in the service; the controller only validates DTOs and delegates.
- The module owns its own Postgres schema `$1` (Prisma `@@schema("$1")`). No cross-schema JOINs — reference other modules by **scalar id** and call their service.
- Money as integer cents; soft delete via `archivedAt`.
- Validate all input with class-validator DTOs.
- Register the module in the root `AppModule`.

First present a short plan (files to create + any Prisma models to add). Wait for my approval before writing code.
