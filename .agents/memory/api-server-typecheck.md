---
name: api-server typecheck
description: How to correctly typecheck the api-server (and other workspace packages) without false errors from stale lib dists.
---

# api-server typecheck

Running `pnpm --filter @workspace/api-server run typecheck` (which is `tsc -p tsconfig.json --noEmit`) reports many false `@workspace/db has no exported member ...` / DrizzleTypeError errors. That command relies on the prebuilt declaration outputs of referenced projects (`lib/db`, `lib/api-zod`), which can be stale.

**Use the root `pnpm run typecheck` instead** — it runs `tsc --build` (typecheck:libs) first to rebuild project-reference declarations, then per-artifact typechecks. After that, only real errors remain.

**Pre-existing errors (not from MCP work):** `src/lib/imagePipeline.ts`, `src/lib/storage.ts`, `src/routes/uploads.ts` in api-server, and `src/pages/home.tsx:70` (`statusRes.status === "error"` vs a generated status enum that lacks `"error"`) in launchpad. These exist on the base branch.

**Why:** the actual production build is esbuild (`build.mjs`), which bundles without type-checking, so these type errors do not block the build or runtime.
