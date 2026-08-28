# LaunchPad MCP Server

LaunchPad exposes its campaign capabilities as a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server, so AI assistants like Claude Desktop and Cursor can create, manage, publish, and monitor ad campaigns on your behalf.

The MCP server is **embedded inside the existing `api-server`** (it is not a separate service). It reuses the same magic-link auth, database, Stripe, and Meta/TikTok/Google ad clients that power the LaunchPad website — so anything you can do in the UI, you can do from an MCP client.

> ⚠️ **This MCP exposes the full campaign lifecycle, including publishing and pausing.** Publishing creates a Stripe Checkout session and, once paid, launches **live ads that spend real money**. Pausing immediately stops live ads. See [Safety](#safety) below.

---

## Endpoint

The server speaks the MCP **Streamable HTTP** transport at:

```
POST /api/mcp
```

| Environment | URL |
|-------------|-----|
| Development | `https://<your-repl-dev-domain>/api/mcp` |
| Deployed    | `https://<your-deployed-domain>/api/mcp` |

The endpoint is **stateless** — each request is handled by a fresh server instance scoped to the authenticated user. Only `POST` is supported; `GET` and `DELETE` return `405`.

---

## Authentication

Every request must include a LaunchPad **magic-link token** in the `Authorization` header:

```
Authorization: Bearer <your-launchpad-token>
```

(An `X-LaunchPad-Token: <token>` header is also accepted for clients that cannot set `Authorization`.)

All tools are scoped to the user the token belongs to — you can only see and modify your own campaigns. Requests with a missing, invalid, or expired token are rejected with a JSON-RPC `-32001` error.

### How to get a token

1. Open the LaunchPad website and ship (publish) a campaign, or otherwise trigger a login email.
2. LaunchPad emails you a **magic link** that looks like `https://<domain>/campaigns?token=<token>`.
3. Copy the `token` query-parameter value from that link — that is your LaunchPad token.
4. Tokens are valid for **7 days**. When one expires, request a new magic link and copy the new token.

> Treat the token like a password: it grants full access to your campaigns, including the ability to publish live ads.

---

## Connecting a client

### Claude Desktop

Claude Desktop connects to remote MCP servers via [`mcp-remote`](https://www.npmjs.com/package/mcp-remote). Edit your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "launchpad": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://<your-domain>/api/mcp",
        "--header",
        "Authorization: Bearer <your-launchpad-token>"
      ]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "launchpad": {
      "url": "https://<your-domain>/api/mcp",
      "headers": {
        "Authorization": "Bearer <your-launchpad-token>"
      }
    }
  }
}
```

Clients that don't support remote URLs directly can use the `mcp-remote` bridge shown in the Claude Desktop example.

---

## Tool reference

| Tool | Purpose | Inputs | Output |
|------|---------|--------|--------|
| `generate_campaign` | Generate a complete campaign from a product brief. Returns immediately with status `generating`; poll `get_campaign_status` until `ready`. | `brief` (string, ≥5 chars), `productImageUrl` (string URL, optional) | Campaign object (`id`, `status`, `landingUrl`, …) |
| `list_campaigns` | List all of your campaigns, newest first. | _none_ | Array of `{ id, brandName, status, spendTodayCents, createdAt }` |
| `get_campaign` | Get full details of one campaign. | `id` (string) | Campaign object incl. AI-generated `campaignData` |
| `get_campaign_status` | Poll generation + per-ad image status. | `id` (string) | `{ id, status, campaignData, adAssets[] }` |
| `revise_campaign` | Revise a campaign in natural language. Drafts allow 3 free revisions; shipped campaigns are unlimited. Images regenerate if visuals change. | `id` (string), `request` (string) | Updated campaign object |
| `publish_campaign` ⚠️ | Start publishing: creates a Stripe Checkout session. Returns a `checkoutUrl` the user must open to pay. Live ads launch only after checkout completes. | `id` (string), `dailyBudgetCents` (int), `metaSharePct` (0–100), `tiktokSharePct` (0–100), `googleSharePct` (0–100, optional remainder), `successUrl` (string URL, optional) | `{ checkoutUrl, note }` |
| `pause_campaign` ⚠️ | Immediately pause a live campaign across Meta + TikTok + Google, stopping ad spend. | `id` (string) | Updated campaign object (status `paused`) |
| `get_campaign_metrics` | Fetch live metrics (impressions, clicks, spend). Zeros if not live. | `id` (string) | `{ campaignId, impressions, clicks, spendCents, updatedAt }` |

Tool results are returned as JSON text content. Failures (not found, forbidden, revision limit reached, etc.) come back with `isError: true` and a `code: message` string.

---

## Safety

`publish_campaign` and `pause_campaign` affect **real money and live ads**:

- **`publish_campaign` does not charge silently.** It returns a Stripe Checkout URL. The user must open that URL and complete payment. Only after checkout succeeds does LaunchPad charge the subscription and launch live ads on Meta/TikTok/Google that spend the configured daily budget.
- **`pause_campaign` takes effect immediately** — it stops a running campaign's ad spend across all platforms.
- Always confirm the daily budget and channel split with the user before publishing, and confirm before pausing an actively running campaign.

In development the app runs with `ADS_MODE=mock`, so no real ad spend occurs even though the full flow (including Stripe Checkout) executes. Client brands publish to per-customer ad account IDs, not LaunchPad house env IDs. Set `ADS_MODE=live` only after Meta/TikTok/Google credentials are in place and On Behalf Of / partner / MCC access is granted. Saving connector credentials does not flip live.

---

## Implementation notes

- MCP server module: `artifacts/api-server/src/mcp/server.ts` — builds a per-request `McpServer` scoped to the authenticated user and registers all tools.
- HTTP transport + auth: `artifacts/api-server/src/routes/mcp.ts` — mounted at `/api/mcp`, validates the bearer token with `verifyToken`.
- Shared business logic: `artifacts/api-server/src/lib/campaignService.ts` — the same service functions back both the REST routes and the MCP tools, so there is a single implementation per capability.
