import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as svc from "../lib/campaignService.js";
import { logger } from "../lib/logger.js";
import { resolveGoogleSharePct } from "../lib/channelSplit.js";

export interface McpAuth {
  userId: string;
  email: string;
}

/**
 * Build a per-request MCP server scoped to a single authenticated LaunchPad
 * user. Every tool operates only on campaigns owned by `auth.userId`.
 */
export function buildMcpServer(auth: McpAuth): McpServer {
  const server = new McpServer(
    { name: "launchpad", version: "1.0.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "LaunchPad lets you create, manage, publish, and monitor AI-generated ad " +
        "campaigns on Meta, TikTok, and Google. Tools are scoped to the authenticated user. " +
        "publish_campaign and pause_campaign affect REAL ad spend and LIVE ads — " +
        "publish returns a Stripe Checkout URL the user must open to complete payment.",
    },
  );

  const ok = (data: unknown): CallToolResult => ({
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  });

  const fail = (message: string): CallToolResult => ({
    content: [{ type: "text", text: message }],
    isError: true,
  });

  /** Wrap a tool handler with shared error → MCP error mapping. */
  function tool(
    handler: (args: Record<string, unknown>) => Promise<CallToolResult>,
  ) {
    return async (args: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        return await handler(args);
      } catch (err) {
        if (err instanceof svc.ServiceError) {
          return fail(`${err.code}: ${err.message}`);
        }
        logger.error({ err }, "MCP tool error");
        return fail(
          err instanceof Error ? err.message : "Unexpected error running tool",
        );
      }
    };
  }

  /** Ensure the campaign exists and is owned by the authenticated user. */
  async function requireOwned(id: string) {
    const campaign = await svc.getCampaignRecord(id);
    if (!campaign) {
      throw new svc.ServiceError(404, "not_found", "Campaign not found");
    }
    if (campaign.userId !== auth.userId) {
      throw new svc.ServiceError(
        403,
        "forbidden",
        "This campaign is not associated with your account",
      );
    }
    return campaign;
  }

  const idSchema = z
    .string()
    .describe("The campaign id (e.g. cmp_xxxxxxxx) returned by generate_campaign or list_campaigns");

  server.registerTool(
    "generate_campaign",
    {
      title: "Generate campaign",
      description:
        "Generate a complete ad campaign from a short product brief. Returns a campaign " +
        "with status 'generating'; poll get_campaign_status until it becomes 'ready' to " +
        "see the brand name, three ads, and landing page. No charges occur.",
      inputSchema: {
        brief: z
          .string()
          .min(5)
          .describe("A description of the product to advertise (min 5 characters)"),
        productImageUrl: z
          .string()
          .url()
          .nullish()
          .describe("Optional URL of a pre-uploaded product image"),
      },
    },
    tool(async (args) => {
      const campaign = await svc.createCampaign({
        brief: args.brief as string,
        productImageUrl: (args.productImageUrl as string | null) ?? null,
        userId: auth.userId,
      });
      return ok(campaign);
    }),
  );

  server.registerTool(
    "list_campaigns",
    {
      title: "List campaigns",
      description:
        "List all campaigns belonging to the authenticated user, newest first, with id, " +
        "brand name, status, and today's spend (for live campaigns).",
      inputSchema: {},
    },
    tool(async () => {
      const campaigns = await svc.listCampaignsForUser(auth.userId);
      return ok(campaigns);
    }),
  );

  server.registerTool(
    "get_campaign",
    {
      title: "Get campaign",
      description:
        "Get the full details of one campaign: brief, status, the AI-generated campaign " +
        "JSON (brand, ads, landing copy), landing URL, and revision counts.",
      inputSchema: { id: idSchema },
    },
    tool(async (args) => {
      await requireOwned(args.id as string);
      return ok(await svc.getCampaign(args.id as string));
    }),
  );

  server.registerTool(
    "get_campaign_status",
    {
      title: "Get campaign status",
      description:
        "Poll a campaign's generation and image status. Returns the overall status plus " +
        "each ad asset's image URL and status. Use after generate_campaign or revise_campaign.",
      inputSchema: { id: idSchema },
    },
    tool(async (args) => {
      await requireOwned(args.id as string);
      return ok(await svc.getCampaignStatus(args.id as string));
    }),
  );

  server.registerTool(
    "revise_campaign",
    {
      title: "Revise campaign",
      description:
        "Revise a campaign in natural language (e.g. 'make the tone more playful' or " +
        "'target an older audience'). Draft campaigns allow 3 free revisions; shipped " +
        "campaigns are unlimited. Images regenerate automatically if the visuals change.",
      inputSchema: {
        id: idSchema,
        request: z
          .string()
          .min(1)
          .describe("Plain-language description of what to change"),
      },
    },
    tool(async (args) => {
      await requireOwned(args.id as string);
      return ok(
        await svc.reviseCampaignById(args.id as string, args.request as string),
      );
    }),
  );

  server.registerTool(
    "publish_campaign",
    {
      title: "Publish campaign (REAL CHARGES)",
      description:
        "⚠️ AFFECTS REAL MONEY. Starts publishing a campaign by creating a Stripe Checkout " +
        "session. This does NOT charge immediately — it returns a checkoutUrl that the user " +
        "must open and complete. Once paid, the campaign enters in_review; an admin must " +
        "approve before ads run. v1 channels: Meta, TikTok, Google. LinkedIn is out of v1.",
      inputSchema: {
        id: idSchema,
        dailyBudgetCents: z
          .number()
          .int()
          .positive()
          .describe("Daily ad budget in cents (e.g. 2500 = $25, 7500 = $75, 20000 = $200)"),
        metaSharePct: z
          .number()
          .min(0)
          .max(100)
          .describe("Percentage of the budget allocated to Meta (0-100)"),
        tiktokSharePct: z
          .number()
          .min(0)
          .max(100)
          .describe("Percentage of the budget allocated to TikTok (0-100)"),
        googleSharePct: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Percentage of the budget allocated to Google Ads (0-100); meta+tiktok+google should sum to 100"),
        successUrl: z
          .string()
          .url()
          .nullish()
          .describe("Optional URL to redirect to after successful checkout"),
      },
    },
    tool(async (args) => {
      await requireOwned(args.id as string);
      const result = await svc.publishCampaignById(args.id as string, {
        dailyBudgetCents: args.dailyBudgetCents as number,
        metaSharePct: args.metaSharePct as number,
        tiktokSharePct: args.tiktokSharePct as number,
        googleSharePct: resolveGoogleSharePct(
          args.metaSharePct as number,
          args.tiktokSharePct as number,
          args.googleSharePct as number | undefined,
        ),
        successUrl: (args.successUrl as string | null) ?? null,
      });
      return ok({
        ...result,
        note: "Open checkoutUrl to complete payment. Live ads launch only after checkout succeeds.",
      });
    }),
  );

  server.registerTool(
    "pause_campaign",
    {
      title: "Pause campaign (LIVE ADS)",
      description:
        "⚠️ AFFECTS LIVE ADS. Immediately pauses a live campaign across Meta and TikTok, " +
        "stopping further ad spend. The campaign status becomes 'paused'. Confirm with the " +
        "user before pausing a campaign that is actively running.",
      inputSchema: { id: idSchema },
    },
    tool(async (args) => {
      await requireOwned(args.id as string);
      return ok(await svc.pauseCampaignById(args.id as string));
    }),
  );

  server.registerTool(
    "get_campaign_metrics",
    {
      title: "Get campaign metrics",
      description:
        "Fetch live performance metrics (impressions, clicks, spend in cents) for a " +
        "campaign. Returns zeros for campaigns that are not currently live.",
      inputSchema: { id: idSchema },
    },
    tool(async (args) => {
      await requireOwned(args.id as string);
      return ok(await svc.getCampaignMetrics(args.id as string));
    }),
  );

  return server;
}
