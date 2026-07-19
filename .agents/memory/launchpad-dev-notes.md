---
name: LaunchPad dev & landing constraints
description: Non-obvious dev-loop and security constraints for the LaunchPad api-server and server-rendered landing pages.
---

## api-server has no dev file watcher
The `artifacts/api-server` dev workflow runs `build && start` (esbuild bundle, then `node dist`), with NO watcher.
**Why:** the dev script is `NODE_ENV=development && pnpm run build && pnpm run start` — no nodemon/tsx watch.
**How to apply:** after editing anything under `artifacts/api-server/src`, restart the workflow `artifacts/api-server: API Server` before curl/e2e testing, or changes won't be live. The launchpad (Vite) frontend DOES hot-reload, so frontend-only edits need no restart.

## One-off TS scripts against api-server code (no tsx installed)
To run a single api-server function ad hoc (e.g. exercising a service directly), bundle a tiny entry with esbuild instead of tsx: `npx esbuild tmp.ts --bundle --platform=node --format=esm --external:pino --external:pino-pretty --outfile=tmp.mjs` then `node tmp.mjs`.
**Why:** tsx isn't installed; `--packages=external` fails because @workspace libs resolve to TS source; bundling everything works if pino/pino-pretty stay external (the real build needs a pino esbuild plugin, a one-off doesn't).
**How to apply:** add a `--banner:js` that recreates `require` for CJS interop; delete the temp files afterward.

## Test the api-server in-container (mTLS proxy)
Curl at `http://localhost:8080` from inside the container. Hitting it via `$REPLIT_DEV_DOMAIN` from a shell fails — the preview proxy uses mTLS. The browser preview reaches it through path routing (`/api`, `/p`).

## Landing page renders AI-controlled strings → escape + sanitize
`routes/landing.ts` server-renders HTML from `campaign.campaignJson` (brandName, tagline, hero, sub, features[], socialProof, cta) and the AI-provided `palette` (injected into inline CSS).
**Why:** these are model/DB-controlled, so raw interpolation is an XSS / CSS-injection vector.
**How to apply:** route every text interpolation through `escHtml`/`escAttr`, every color through `sanitizeColor` (allowlist `#hex` / `rgb()` / `hsl()` only — else fall back), and coerce fields with `String(...)` before `.trim()`/`.split()` so malformed DB rows can't 500.

## Admin auth is a stateless HMAC token
`routes/admin.ts`: `POST /api/admin/login` timing-safe-compares the password to `ADMIN_PASSWORD`, then returns `"<expMs>.<hmacSHA256(expMs, ADMIN_PASSWORD)>"`. The client stores it in localStorage and sends it as the `x-admin-token` header; protected routes verify it and 503 when `ADMIN_PASSWORD` is unset.
**Why:** stateless tokens survive the frequent api-server restarts (an in-memory token store would not); a header token (not a cookie) avoids CSRF and needs no cookie-parser.
**How to apply:** keep tokens stateless; reject malformed signatures (`/^[a-f0-9]{64}$/i`) before `timingSafeEqual` to avoid 500s; there is a lightweight in-memory per-IP login throttle (resets on restart, which is fine).
