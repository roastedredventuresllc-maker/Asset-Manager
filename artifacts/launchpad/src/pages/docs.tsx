import { useLocation } from "wouter";

const TOOLS: { name: string; warn?: boolean; purpose: string; inputs: string; output: string }[] = [
  {
    name: "generate_campaign",
    purpose: "Generate a complete campaign from a product brief. Returns when copy is ready; stills may still be rendering.",
    inputs: "brief (string, ≥5 chars), productImageUrl (URL, optional)",
    output: "Campaign object (id, status, landingUrl, …)",
  },
  {
    name: "list_campaigns",
    purpose: "List all of your campaigns, newest first.",
    inputs: "none",
    output: "Array of { id, brandName, status, spendTodayCents, createdAt }",
  },
  {
    name: "get_campaign",
    purpose: "Get full details of one campaign.",
    inputs: "id (string)",
    output: "Campaign object incl. AI-generated campaignData",
  },
  {
    name: "get_campaign_status",
    purpose: "Poll generation + per-ad image status.",
    inputs: "id (string)",
    output: "{ id, status, campaignData, adAssets[] }",
  },
  {
    name: "revise_campaign",
    purpose: "Revise a campaign in natural language. Drafts allow 3 free revisions; shipped campaigns are unlimited.",
    inputs: "id (string), request (string)",
    output: "Updated campaign object",
  },
  {
    name: "publish_campaign",
    warn: true,
    purpose: "Start publishing: creates a Stripe Checkout session and returns a checkoutUrl the user must open to pay. Live ads launch only after checkout completes.",
    inputs: "id, dailyBudgetCents (int), metaSharePct (0–100), tiktokSharePct (0–100), successUrl (URL, optional)",
    output: "{ checkoutUrl, note }",
  },
  {
    name: "pause_campaign",
    warn: true,
    purpose: "Immediately pause a live campaign across Meta + TikTok, stopping ad spend.",
    inputs: "id (string)",
    output: "Updated campaign object (status paused)",
  },
  {
    name: "get_campaign_metrics",
    purpose: "Fetch live metrics (impressions, clicks, spend). Zeros if not live.",
    inputs: "id (string)",
    output: "{ campaignId, impressions, clicks, spendCents, updatedAt }",
  },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-secondary text-foreground rounded-xl p-4 overflow-x-auto text-xs md:text-sm font-mono leading-relaxed border border-border">
      <code>{children}</code>
    </pre>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35 mb-6 mt-20 first:mt-0">
      {children}
    </div>
  );
}

export default function Docs() {
  const [, setLocation] = useLocation();
  const endpoint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/mcp`
      : "https://<your-domain>/api/mcp";

  const claudeConfig = `{
  "mcpServers": {
    "launchpad": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${endpoint}",
        "--header",
        "Authorization: Bearer <your-launchpad-token>"
      ]
    }
  }
}`;

  const cursorConfig = `{
  "mcpServers": {
    "launchpad": {
      "url": "${endpoint}",
      "headers": {
        "Authorization": "Bearer <your-launchpad-token>"
      }
    }
  }
}`;

  return (
    <div className="min-h-[100dvh] bg-background animate-in fade-in duration-700">
      <header className="flex justify-between items-center max-w-[860px] mx-auto px-6 py-6">
        <button
          onClick={() => setLocation("/")}
          className="font-sans font-bold text-xl tracking-tighter hover:opacity-70 transition-opacity"
        >
          LP
        </button>
        <button
          onClick={() => setLocation("/")}
          className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to LaunchPad
        </button>
      </header>

      <main className="max-w-[860px] mx-auto px-6 pb-32">
        <div className="mt-12 mb-4">
          <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35 mb-4">
            Developers
          </div>
          <h1 className="font-serif text-5xl md:text-6xl leading-none mb-4">
            MCP Server
          </h1>
          <p className="font-serif italic text-xl text-muted-foreground max-w-[640px]">
            Let AI assistants like Claude Desktop and Cursor run your ad campaigns
            through the Model Context Protocol.
          </p>
        </div>

        {/* Safety callout */}
        <div className="mt-12 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
          <div className="font-sans font-bold text-sm mb-2">
            ⚠️ This exposes the full campaign lifecycle — including real spend
          </div>
          <p className="font-sans text-sm leading-relaxed">
            The <code className="bg-red-100 px-1 rounded">publish_campaign</code> and{" "}
            <code className="bg-red-100 px-1 rounded">pause_campaign</code> tools affect
            real money and live ads. Publishing creates a Stripe Checkout session and,
            once paid, launches live ads that spend your daily budget. Pausing
            immediately stops a running campaign. Always confirm budget and channel
            split before publishing.
          </p>
        </div>

        <SectionTitle>Overview</SectionTitle>
        <div className="font-sans text-[15px] leading-relaxed text-foreground/90 space-y-4">
          <p>
            LaunchPad exposes its campaign capabilities as a{" "}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 decoration-border hover:text-foreground"
            >
              Model Context Protocol
            </a>{" "}
            server. Anything you can do in the website — generate, revise, publish, pause,
            and monitor campaigns — you can do from an MCP client.
          </p>
          <p>
            The server speaks the MCP <strong>Streamable HTTP</strong> transport. It is
            stateless: each request is handled by a fresh server instance scoped to the
            authenticated user. Only <code className="bg-secondary px-1 rounded text-sm">POST</code> is supported.
          </p>
        </div>

        <SectionTitle>Endpoint</SectionTitle>
        <CodeBlock>{`POST ${endpoint}`}</CodeBlock>

        <SectionTitle>Get a token</SectionTitle>
        <div className="font-sans text-[15px] leading-relaxed text-foreground/90 space-y-4">
          <p>
            Every request authenticates with a LaunchPad magic-link token sent as a
            bearer header:
          </p>
          <CodeBlock>{`Authorization: Bearer <your-launchpad-token>`}</CodeBlock>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Ship (publish) a campaign on the website, or otherwise trigger a login email.</li>
            <li>
              LaunchPad emails you a magic link like{" "}
              <code className="bg-secondary px-1 rounded text-sm">
                https://&lt;domain&gt;/campaigns?token=&lt;token&gt;
              </code>
              .
            </li>
            <li>
              Copy the <code className="bg-secondary px-1 rounded text-sm">token</code>{" "}
              query-parameter value — that is your token.
            </li>
            <li>Tokens are valid for 7 days. Request a new magic link when one expires.</li>
          </ol>
          <p className="text-muted-foreground text-sm">
            Treat the token like a password — it grants full access to your campaigns,
            including publishing live ads.
          </p>
        </div>

        <SectionTitle>Connect a client</SectionTitle>
        <div className="font-sans text-[15px] leading-relaxed text-foreground/90 space-y-3">
          <p className="font-bold">Claude Desktop</p>
          <p className="text-sm text-muted-foreground">
            Edit <code className="bg-secondary px-1 rounded text-sm">claude_desktop_config.json</code>:
          </p>
          <CodeBlock>{claudeConfig}</CodeBlock>
          <p className="font-bold pt-4">Cursor</p>
          <p className="text-sm text-muted-foreground">
            Add to <code className="bg-secondary px-1 rounded text-sm">.cursor/mcp.json</code>:
          </p>
          <CodeBlock>{cursorConfig}</CodeBlock>
        </div>

        <SectionTitle>Tool reference</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-bold align-top">Tool</th>
                <th className="py-3 pr-4 font-bold align-top">Purpose</th>
                <th className="py-3 pr-4 font-bold align-top">Inputs</th>
                <th className="py-3 font-bold align-top">Output</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((t) => (
                <tr key={t.name} className="border-b border-border/60 align-top">
                  <td className="py-3 pr-4">
                    <code className="bg-secondary px-1.5 py-0.5 rounded text-xs whitespace-nowrap">
                      {t.name}
                    </code>
                    {t.warn && (
                      <span className="block text-[10px] font-bold text-red-600 mt-1 uppercase tracking-wide">
                        ⚠️ real spend
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-foreground/80">{t.purpose}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{t.inputs}</td>
                  <td className="py-3 text-muted-foreground">{t.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="font-sans text-sm text-muted-foreground mt-6">
          Tool results are returned as JSON text. Failures (not found, forbidden,
          revision limit reached, …) come back flagged as errors with a{" "}
          <code className="bg-secondary px-1 rounded text-xs">code: message</code> string.
        </p>
      </main>
    </div>
  );
}
