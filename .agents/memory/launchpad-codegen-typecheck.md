---
name: LaunchPad codegen & typecheck workflow
description: How the OpenAPI-driven codegen and monorepo typecheck fit together; gotchas that aren't obvious from a single file.
---

# Codegen + typecheck workflow

- `lib/api-spec/openapi.yaml` is the source of truth for the API contract. It drives
  codegen for `@workspace/api-zod` (Zod schemas) and `@workspace/api-client-react`
  (React Query hooks). After editing the spec (e.g. adding a value to an enum like
  the campaign `status`), you must re-run codegen or the generated types drift from
  the spec. The same enum often must be updated in **multiple places** in the yaml.
- `pnpm run typecheck` runs `tsc --build` for the libs (project references) then a
  per-artifact `tsc --noEmit`. The workspace packages have **no build script** —
  they're consumed via source + TypeScript project references, not compiled output.
- **Gotcha:** the `@workspace/db` barrel does NOT re-export drizzle operators. Import
  `eq`, `and`, `lte`, `desc`, `sum`, etc. directly from `drizzle-orm`, not from the
  db package.
