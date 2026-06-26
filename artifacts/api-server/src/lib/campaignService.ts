import {
  db,
  campaignsTable,
  adAssetsTable,
  publishesTable,
  metricsSnapshotsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { generateCampaign, reviseCampaign } from "./claude.js";
import { generateId, generateSlug } from "./ids.js";
import { getAdPlatform } from "../ads/index.js";
import { logger } from "./logger.js";

/**
 * Shared campaign business logic used by both the REST routes
 * (`routes/campaigns.ts`) and the MCP server (`mcp/server.ts`).
 *
 * Functions throw `ServiceError` for expected failure cases so callers can map
 * them to HTTP status codes or MCP error responses without duplicating logic.
 */
export class ServiceError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
    this.code = code;
  }
}

type CampaignRecord = typeof campaignsTable.$inferSelect;

function appDomain(): string {
  return (
    process.env.REPLIT_DEV_DOMAIN ??
    process.env.REPLIT_DOMAINS?.split(",")[0] ??
    "localhost:3000"
  );
}

export function toCampaignResponse(campaign: CampaignRecord) {
  const domain = appDomain();
  return {
    id: campaign.id,
    userId: campaign.userId,
    brief: campaign.brief,
    productImageUrl: campaign.productImageUrl,
    campaignData: campaign.campaignJson ?? null,
    status: campaign.status,
    landingSlug: campaign.landingSlug,
    landingUrl: campaign.landingSlug
      ? `https://${domain}/p/${campaign.landingSlug}`
      : null,
    revisionsUsed: campaign.revisionsUsed,
    revisionsAllowed: campaign.revisionsAllowed,
    createdAt: campaign.createdAt.toISOString(),
  };
}

/** Fetch the raw campaign row, or null if it does not exist. */
export async function getCampaignRecord(
  id: string,
): Promise<CampaignRecord | undefined> {
  return db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, id),
  });
}

/**
 * Background generation: calls Claude, persists the campaign JSON, then
 * enqueues image-generation jobs. Fire-and-forget from the caller.
 */
export async function generateCampaignAsync(
  campaignId: string,
  brief: string,
  productImageUrl: string | null,
  productImageNoBgUrl?: string | null,
): Promise<void> {
  try {
    const campaignData = await generateCampaign(brief);
    const landingSlug = generateSlug(campaignData.brandName);

    await db
      .update(campaignsTable)
      .set({
        campaignJson: campaignData as object,
        status: "ready",
        landingSlug,
      })
      .where(eq(campaignsTable.id, campaignId));

    const { jobsTable } = await import("@workspace/db");

    for (let idx = 0; idx < 3; idx++) {
      const ad = campaignData.ads[idx];
      if (!ad) continue;

      const asset = await db.query.adAssetsTable.findFirst({
        where: and(
          eq(adAssetsTable.campaignId, campaignId),
          eq(adAssetsTable.idx, idx),
        ),
      });
      if (!asset) continue;

      await db.insert(jobsTable).values({
        id: generateId("job"),
        type: "generate_image",
        payload: {
          campaignId,
          adAssetId: asset.id,
          idx,
          ad,
          brandName: campaignData.brandName,
          productImageUrl,
          productImageNoBgUrl: productImageNoBgUrl ?? null,
        },
        status: "pending",
      });
    }

    logger.info({ campaignId }, "Campaign generated successfully");
  } catch (err) {
    logger.error({ err, campaignId }, "Campaign generation error");
    await db
      .update(campaignsTable)
      .set({ status: "error" })
      .where(eq(campaignsTable.id, campaignId));
  }
}

/**
 * Create a campaign record (status: generating) plus three placeholder ad
 * assets, then kick off async generation. `userId` is optional — anonymous web
 * users create campaigns with a null userId (claimed later via checkout), while
 * MCP callers pass their authenticated userId so the campaign is owned up-front.
 */
export async function createCampaign(input: {
  brief: string;
  productImageUrl?: string | null;
  productImageNoBgUrl?: string | null;
  userId?: string | null;
}) {
  const brief = input.brief?.trim();
  if (!brief || brief.length < 5) {
    throw new ServiceError(400, "invalid_brief", "brief is required (min 5 chars)");
  }

  const id = generateId("cmp");
  const productImageUrl = input.productImageUrl ?? null;
  const productImageNoBgUrl = input.productImageNoBgUrl ?? null;

  await db.insert(campaignsTable).values({
    id,
    userId: input.userId ?? null,
    brief,
    productImageUrl,
    status: "generating",
    revisionsUsed: 0,
    revisionsAllowed: 3,
  });

  for (let idx = 0; idx < 3; idx++) {
    await db.insert(adAssetsTable).values({
      id: generateId("ast"),
      campaignId: id,
      idx,
      status: "pending",
    });
  }

  const campaign = await getCampaignRecord(id);

  generateCampaignAsync(id, brief, productImageUrl, productImageNoBgUrl).catch((err) => {
    logger.error({ err, campaignId: id }, "Async campaign generation failed");
  });

  return toCampaignResponse(campaign!);
}

/** List campaign summaries for a user, newest first. */
export async function listCampaignsForUser(userId: string) {
  const campaigns = await db.query.campaignsTable.findMany({
    where: eq(campaignsTable.userId, userId),
    orderBy: [desc(campaignsTable.createdAt)],
  });

  return Promise.all(
    campaigns.map(async (c) => {
      let spendTodayCents: number | null = null;
      if (c.status === "live") {
        const latest = await db.query.metricsSnapshotsTable.findFirst({
          where: and(
            eq(metricsSnapshotsTable.campaignId, c.id),
            eq(metricsSnapshotsTable.platform, "total"),
          ),
          orderBy: [desc(metricsSnapshotsTable.snapshotAt)],
        });
        spendTodayCents = latest?.spendCents ?? 0;
      }
      const cj = c.campaignJson as { brandName?: string } | null;
      return {
        id: c.id,
        brandName: cj?.brandName ?? "Untitled",
        status: c.status,
        spendTodayCents,
        createdAt: c.createdAt.toISOString(),
      };
    }),
  );
}

/** Full campaign details. Throws 404 if not found. */
export async function getCampaign(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");
  return toCampaignResponse(campaign);
}

/** Generation/image status plus per-asset image URLs. Throws 404 if not found. */
export async function getCampaignStatus(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");

  const assets = await db.query.adAssetsTable.findMany({
    where: eq(adAssetsTable.campaignId, id),
    orderBy: [adAssetsTable.idx],
  });

  return {
    id: campaign.id,
    status: campaign.status,
    campaignData: campaign.campaignJson ?? null,
    adAssets: assets.map((a) => ({
      idx: a.idx,
      imageUrl: a.imageUrl ?? null,
      status: a.status,
      model: a.model ?? null,
    })),
  };
}

/** Revise a campaign in natural language. Enforces the draft revision limit. */
export async function reviseCampaignById(id: string, request: string) {
  if (!request || typeof request !== "string" || request.trim().length === 0) {
    throw new ServiceError(400, "invalid_request", "request required");
  }

  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");

  if (campaign.status === "draft" || campaign.status === "ready") {
    if (campaign.revisionsUsed >= campaign.revisionsAllowed) {
      throw new ServiceError(
        403,
        "revision_limit_reached",
        "Ship it to unlock unlimited revisions.",
      );
    }
  }

  const existing = campaign.campaignJson as object;
  if (!existing) {
    throw new ServiceError(400, "not_generated", "campaign not yet generated");
  }

  const { campaign: updated, visualChanged } = await reviseCampaign(
    existing as Parameters<typeof reviseCampaign>[0],
    request,
  );

  const newSlug = generateSlug(updated.brandName);

  await db
    .update(campaignsTable)
    .set({
      campaignJson: updated as object,
      landingSlug: newSlug,
      revisionsUsed: campaign.revisionsUsed + 1,
    })
    .where(eq(campaignsTable.id, id));

  if (visualChanged) {
    const { jobsTable } = await import("@workspace/db");

    // Recover the no-bg URL from the most recent completed job payload for
    // this campaign (stored there at generation time). No schema migration needed.
    let productImageNoBgUrl: string | null = null;
    const prevJob = await db.query.jobsTable.findFirst({
      where: and(
        eq(jobsTable.type, "generate_image"),
        eq(jobsTable.status, "completed"),
      ),
      orderBy: [desc(jobsTable.createdAt)],
    });
    const prevPayload = prevJob?.payload as { campaignId?: string; productImageNoBgUrl?: string | null } | null;
    if (prevPayload?.campaignId === id && prevPayload?.productImageNoBgUrl) {
      productImageNoBgUrl = prevPayload.productImageNoBgUrl;
    }

    await db
      .update(adAssetsTable)
      .set({ status: "pending", imageUrl: null })
      .where(eq(adAssetsTable.campaignId, id));

    for (let idx = 0; idx < 3; idx++) {
      const ad = updated.ads[idx];
      if (!ad) continue;
      const asset = await db.query.adAssetsTable.findFirst({
        where: and(
          eq(adAssetsTable.campaignId, id),
          eq(adAssetsTable.idx, idx),
        ),
      });
      if (!asset) continue;
      await db.insert(jobsTable).values({
        id: generateId("job"),
        type: "generate_image",
        payload: {
          campaignId: id,
          adAssetId: asset.id,
          idx,
          ad,
          brandName: updated.brandName,
          productImageUrl: campaign.productImageUrl,
          productImageNoBgUrl,
        },
        status: "pending",
      });
    }
  }

  const fresh = await getCampaignRecord(id);
  return toCampaignResponse(fresh!);
}

/**
 * Begin publishing a campaign: creates a Stripe Checkout session (which is what
 * actually charges the user and, on completion, publishes live ads) and marks
 * the campaign as `publishing`. Returns the checkout URL.
 */
export async function publishCampaignById(
  id: string,
  opts: {
    dailyBudgetCents: number;
    metaSharePct: number;
    tiktokSharePct: number;
    successUrl?: string | null;
  },
): Promise<{ checkoutUrl: string | null }> {
  const { dailyBudgetCents, metaSharePct, tiktokSharePct, successUrl } = opts;

  if (!dailyBudgetCents || metaSharePct == null || tiktokSharePct == null) {
    throw new ServiceError(
      400,
      "missing_params",
      "dailyBudgetCents, metaSharePct, tiktokSharePct required",
    );
  }

  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");
  if (!campaign.campaignJson) {
    throw new ServiceError(400, "not_generated", "campaign not generated yet");
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new ServiceError(500, "stripe_not_configured", "Stripe not configured");
  }

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey);

  const cj = campaign.campaignJson as { brandName?: string };
  const brandName = cj.brandName ?? "LaunchPad Campaign";
  const domain = appDomain();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `LaunchPad — ${brandName}`,
            description: `Ad campaign + 10% service fee · Pause anytime`,
          },
          unit_amount: 2900,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    metadata: {
      campaignId: id,
      dailyBudgetCents: String(dailyBudgetCents),
      metaSharePct: String(metaSharePct),
      tiktokSharePct: String(tiktokSharePct),
    },
    success_url: successUrl ?? `https://${domain}/?success=true&campaignId=${id}`,
    cancel_url: `https://${domain}/?campaignId=${id}`,
  });

  await db
    .update(campaignsTable)
    .set({ status: "publishing" })
    .where(eq(campaignsTable.id, id));

  return { checkoutUrl: session.url };
}

/** Pause a live campaign across all platforms it was published to. */
export async function pauseCampaignById(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");

  const publishes = await db.query.publishesTable.findMany({
    where: and(
      eq(publishesTable.campaignId, id),
      eq(publishesTable.status, "active"),
    ),
  });

  for (const pub of publishes) {
    if (!pub.externalCampaignId) continue;
    try {
      const platform = await getAdPlatform(pub.platform as "meta" | "tiktok");
      await platform.pauseCampaign(pub.externalCampaignId);
      await db
        .update(publishesTable)
        .set({ status: "paused" })
        .where(eq(publishesTable.id, pub.id));
    } catch (err) {
      logger.error({ err, publishId: pub.id }, "Error pausing platform");
    }
  }

  await db
    .update(campaignsTable)
    .set({ status: "paused" })
    .where(eq(campaignsTable.id, id));

  const fresh = await getCampaignRecord(id);
  return toCampaignResponse(fresh!);
}

/** Live metrics for a campaign (zeros if it is not live). */
export async function getCampaignMetrics(id: string) {
  const campaign = await getCampaignRecord(id);
  if (!campaign) throw new ServiceError(404, "not_found", "Campaign not found");

  if (campaign.status === "live") {
    const publishes = await db.query.publishesTable.findMany({
      where: and(
        eq(publishesTable.campaignId, id),
        eq(publishesTable.status, "active"),
      ),
    });

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpendCents = 0;

    for (const pub of publishes) {
      if (!pub.externalCampaignId) continue;
      try {
        const platform = await getAdPlatform(pub.platform as "meta" | "tiktok");
        const m = await platform.getMetrics(pub.externalCampaignId);
        totalImpressions += m.impressions;
        totalClicks += m.clicks;
        totalSpendCents += m.spendCents;
      } catch (err) {
        logger.warn({ err, publishId: pub.id }, "Error fetching metrics");
      }
    }

    return {
      campaignId: id,
      impressions: totalImpressions,
      clicks: totalClicks,
      spendCents: totalSpendCents,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    campaignId: id,
    impressions: 0,
    clicks: 0,
    spendCents: 0,
    updatedAt: new Date().toISOString(),
  };
}
