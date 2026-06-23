---
name: MCP server
description: How LaunchPad's embedded MCP server is wired into the api-server.
---

# LaunchPad MCP server

LaunchPad exposes its campaign lifecycle as an MCP server embedded **inside the api-server** (not a separate service), reusing magic-link auth, Drizzle, Stripe, and the ad clients in-process.

- Endpoint: `POST /api/mcp` (Streamable HTTP transport, `@modelcontextprotocol/sdk`). GET/DELETE return 405.
- **Stateless pattern:** build a fresh `McpServer` + `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` per request, then `transport.handleRequest(req, res, req.body)`. Because `express.json()` already parsed the body, pass `req.body` — no special body-parsing order needed (unlike the Stripe webhook raw body).
- Auth per request: `Authorization: Bearer <token>` (or `X-LaunchPad-Token`) validated by `verifyToken`; tools are scoped to that user. MCP-created campaigns set `userId` up-front so ownership checks work (anonymous web campaigns have null userId until checkout).

**Why a shared service layer:** tools and REST routes both call `lib/campaignService.ts` (one implementation per capability) instead of duplicating logic. `ServiceError` carries status+code so routes map to HTTP and MCP maps to `isError` results.

**Safety:** `publish_campaign` returns a Stripe Checkout URL (does not charge silently); `pause_campaign` stops live ads — both have warning-worded tool descriptions.

**zod note:** MCP tool input schemas use `zod` (v3, catalog `^3.25.76`), which had to be added as a direct api-server dependency.
