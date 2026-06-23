---
name: esbuild externalizes @google/* in api-server
description: Why @google packages must be direct deps of api-server, not transitive
---

The api-server bundles with esbuild (`artifacts/api-server/build.mjs`) and marks `@google/*` as external. Externalized packages are NOT bundled — Node resolves them from node_modules at runtime.

**Rule:** Any `@google/*` package (e.g. `@google/genai`) used at runtime must be a DIRECT dependency in `artifacts/api-server/package.json`. Having it only as a transitive dep of a workspace lib (e.g. `@workspace/integrations-gemini-ai`) is NOT enough.

**Why:** pnpm links transitive deps under the lib's own node_modules, not the consumer's package root. esbuild externals skip bundling, so at runtime Node needs the package resolvable from the api-server root — which fails with ERR_MODULE_NOT_FOUND. Crucially, `pnpm build` and `tsc` typecheck both still PASS; the failure only appears at runtime on the first code path that imports it.

**How to apply:** When adding any @google-based integration to api-server, add the `@google/*` package directly to `artifacts/api-server/package.json` and run pnpm install. Same trap applies to any other scope esbuild externalizes — check the `external` list in build.mjs.
