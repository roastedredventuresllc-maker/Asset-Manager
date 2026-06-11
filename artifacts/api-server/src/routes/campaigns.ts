import { Router } from "express";
import { db, campaignsTable, adAssetsTable, publishesTable, metricsSnapshotsTable } from "@workspace/db";
import { eq, desc, sum, and } from "drizzle-orm";
import { generateCampaign, reviseCampaign } from "../lib/claude.js";
import { generateId, generateSlug } from "../lib/ids.js";
import { getAdPlatform } from "../ads/index.js";
import { logger } from "../lib/logger.js";
import type Stripe from "stripe";

const router = Router();

// POST /api/campaigns/generate
router.post("/generate", async (req, res) => {
  const { brief, productImageUrl } = req.body as {
    brief?: string;
    productImageUrl?: string | null;
  };

  if (!brief || typeof brief !== "string" || brief.trim().length < 5) {
    return res.status(400).json({ error: "brief is required (min 5 chars)" });
  }

  const id = generateId("cmp");

  // Create campaign record immediately (status: generating)
  await db.insert(campaignsTable).values({
    id,
    brief: brief.trim(),
    productImageUrl: productImageUrl ?? null,
    status: "generating",
    revisionsUsed: 0,
    revisionsAllowed: 3,
  });

  // Create 3 placeholder ad asset rows
  for (let idx = 0; idx < 3; idx++) {
    await db.insert(adAssetsTable).values({
      id: generateId("ast"),
      campaignId: id,
      idx,
      status: "pending",
    });
  }

  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, id),
  });

  // Fire and forget generation
  generateCampaignAsync(id, brief.trim(), productImageUrl ?? null).catch((err) => {
    logger.error({ err, campaignId: id }, "Async campaign generation failed");
  });

  return res.status(201).json(toCampaignResponse(campaign!));
});

async function generateCampaignAsync(
  campaignId: string,
  brief: string,
  productImageUrl: string | null,
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

    // Enqueue image generation jobs
    const { jobsTable } = await import("@workspace/db");
    const { generateId: gid } = await import("../lib/ids.js");

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
        id: gid("job"),
        type: "generate_image",
        payload: {
          campaignId,
          adAssetId: asset.id,
          idx,
          ad,
          brandName: campaignData.brandName,
          productImageUrl,
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

// GET /api/campaigns
router.get("/", async (req, res) => {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(401).json({ error: "token required" });

  const { verifyToken } = await import("../lib/auth.js");
  const authResult = await verifyToken(token);
  if (!authResult) return res.status(401).json({ error: "invalid or expired token" });

  const campaigns = await db.query.campaignsTable.findMany({
    where: eq(campaignsTable.userId, authResult.userId),
    orderBy: [desc(campaignsTable.createdAt)],
  });

  const summaries = await Promise.all(
    campaigns.map(async (c) => {
      let spendTodayCents = null;
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

  return res.json(summaries);
});

// GET /api/campaigns/:id
router.get("/:id", async (req, res) => {
  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  if (!campaign) return res.status(404).json({ error: "not found" });
  return res.json(toCampaignResponse(campaign));
});

// POST /api/campaigns/:id/revise
router.post("/:id/revise", async (req, res) => {
  const { request } = req.body as { request?: string };
  if (!request) return res.status(400).json({ error: "request required" });

  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  if (!campaign) return res.status(404).json({ error: "not found" });

  // Enforce revision limits for draft campaigns
  if (campaign.status === "draft" || campaign.status === "ready") {
    if (campaign.revisionsUsed >= campaign.revisionsAllowed) {
      return res.status(403).json({
        error: "revision_limit_reached",
        message: "Ship it to unlock unlimited revisions.",
      });
    }
  }

  const existing = campaign.campaignJson as object;
  if (!existing) return res.status(400).json({ error: "campaign not yet generated" });

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
    .where(eq(campaignsTable.id, req.params.id));

  // Re-enqueue image jobs if visual content changed
  if (visualChanged) {
    const { jobsTable } = await import("@workspace/db");
    const { generateId: gid } = await import("../lib/ids.js");

    await db
      .update(adAssetsTable)
      .set({ status: "pending", imageUrl: null })
      .where(eq(adAssetsTable.campaignId, req.params.id));

    for (let idx = 0; idx < 3; idx++) {
      const ad = updated.ads[idx];
      if (!ad) continue;
      const asset = await db.query.adAssetsTable.findFirst({
        where: and(
          eq(adAssetsTable.campaignId, req.params.id),
          eq(adAssetsTable.idx, idx),
        ),
      });
      if (!asset) continue;
      await db.insert(jobsTable).values({
        id: gid("job"),
        type: "generate_image",
        payload: {
          campaignId: req.params.id,
          adAssetId: asset.id,
          idx,
          ad,
          brandName: updated.brandName,
          productImageUrl: campaign.productImageUrl,
        },
        status: "pending",
      });
    }
  }

  const fresh = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  return res.json(toCampaignResponse(fresh!));
});

// POST /api/campaigns/:id/publish
router.post("/:id/publish", async (req, res) => {
  const { dailyBudgetCents, metaSharePct, tiktokSharePct, successUrl } =
    req.body as {
      dailyBudgetCents?: number;
      metaSharePct?: number;
      tiktokSharePct?: number;
      successUrl?: string | null;
    };

  if (!dailyBudgetCents || !metaSharePct || !tiktokSharePct) {
    return res.status(400).json({ error: "dailyBudgetCents, metaSharePct, tiktokSharePct required" });
  }

  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  if (!campaign) return res.status(404).json({ error: "not found" });
  if (!campaign.campaignJson) return res.status(400).json({ error: "campaign not generated yet" });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: "Stripe not configured" });
  }

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(stripeKey);

  const cj = campaign.campaignJson as { brandName?: string };
  const brandName = cj.brandName ?? "LaunchPad Campaign";

  const domain =
    process.env.REPLIT_DEV_DOMAIN ??
    process.env.REPLIT_DOMAINS?.split(",")[0] ??
    "localhost:3000";

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
          unit_amount: 2900, // $29/mo base
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    metadata: {
      campaignId: req.params.id,
      dailyBudgetCents: String(dailyBudgetCents),
      metaSharePct: String(metaSharePct),
      tiktokSharePct: String(tiktokSharePct),
    },
    success_url: successUrl ?? `https://${domain}/?success=true&campaignId=${req.params.id}`,
    cancel_url: `https://${domain}/?campaignId=${req.params.id}`,
  });

  await db
    .update(campaignsTable)
    .set({ status: "publishing" })
    .where(eq(campaignsTable.id, req.params.id));

  return res.json({ checkoutUrl: session.url });
});

// POST /api/campaigns/:id/pause
router.post("/:id/pause", async (req, res) => {
  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  if (!campaign) return res.status(404).json({ error: "not found" });

  const publishes = await db.query.publishesTable.findMany({
    where: and(
      eq(publishesTable.campaignId, req.params.id),
      eq(publishesTable.status, "active"),
    ),
  });

  for (const pub of publishes) {
    if (!pub.externalCampaignId) continue;
    try {
      const platform = getAdPlatform(pub.platform as "meta" | "tiktok");
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
    .where(eq(campaignsTable.id, req.params.id));

  const fresh = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  return res.json(toCampaignResponse(fresh!));
});

// GET /api/campaigns/:id/metrics
router.get("/:id/metrics", async (req, res) => {
  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  if (!campaign) return res.status(404).json({ error: "not found" });

  if (campaign.status === "live") {
    // Try to fetch fresh metrics from platforms
    const publishes = await db.query.publishesTable.findMany({
      where: and(
        eq(publishesTable.campaignId, req.params.id),
        eq(publishesTable.status, "active"),
      ),
    });

    let totalImpressions = 0;
    let totalClicks = 0;
    let totalSpendCents = 0;

    for (const pub of publishes) {
      if (!pub.externalCampaignId) continue;
      try {
        const platform = getAdPlatform(pub.platform as "meta" | "tiktok");
        const m = await platform.getMetrics(pub.externalCampaignId);
        totalImpressions += m.impressions;
        totalClicks += m.clicks;
        totalSpendCents += m.spendCents;
      } catch (err) {
        logger.warn({ err, publishId: pub.id }, "Error fetching metrics");
      }
    }

    return res.json({
      campaignId: req.params.id,
      impressions: totalImpressions,
      clicks: totalClicks,
      spendCents: totalSpendCents,
      updatedAt: new Date().toISOString(),
    });
  }

  return res.json({
    campaignId: req.params.id,
    impressions: 0,
    clicks: 0,
    spendCents: 0,
    updatedAt: new Date().toISOString(),
  });
});

// GET /api/campaigns/:id/status
router.get("/:id/status", async (req, res) => {
  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  if (!campaign) return res.status(404).json({ error: "not found" });

  const assets = await db.query.adAssetsTable.findMany({
    where: eq(adAssetsTable.campaignId, req.params.id),
    orderBy: [adAssetsTable.idx],
  });

  return res.json({
    id: campaign.id,
    status: campaign.status,
    campaignData: campaign.campaignJson ?? null,
    adAssets: assets.map((a) => ({
      idx: a.idx,
      imageUrl: a.imageUrl ?? null,
      status: a.status,
      model: a.model ?? null,
    })),
  });
});

function toCampaignResponse(campaign: {
  id: string;
  userId: string | null;
  brief: string;
  productImageUrl: string | null;
  campaignJson: unknown;
  status: string;
  landingSlug: string | null;
  revisionsUsed: number;
  revisionsAllowed: number;
  createdAt: Date;
}) {
  const domain =
    process.env.REPLIT_DEV_DOMAIN ??
    process.env.REPLIT_DOMAINS?.split(",")[0] ??
    "localhost:3000";

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

export default router;
