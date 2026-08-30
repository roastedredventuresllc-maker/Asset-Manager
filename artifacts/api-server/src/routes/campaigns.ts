import { Router } from "express";
import { db, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { publishCampaignToPlatforms } from "../lib/publish.js";
import { adsMode } from "../ads/connectors.js";
import { verifyToken } from "../lib/auth.js";
import * as svc from "../lib/campaignService.js";
import { logger } from "../lib/logger.js";
import { resolveGoogleSharePct } from "../lib/channelSplit.js";

const router = Router();

function handleError(err: unknown, res: import("express").Response): void {
  if (err instanceof svc.ServiceError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  logger.error({ err }, "Campaign route error");
  res.status(500).json({ error: "internal_error" });
}

// POST /api/campaigns/generate
router.post("/generate", async (req, res) => {
  const { brief, productImageUrl, productImageNoBgUrl } = req.body as {
    brief?: string;
    productImageUrl?: string | null;
    productImageNoBgUrl?: string | null;
  };
  res.setHeader("Content-Type", "application/json");
  try {
    const { campaign, stillsJobIds } = await svc.createCampaign({
      brief: brief ?? "",
      productImageUrl,
      productImageNoBgUrl,
    });
    // Flush campaign + copy now. Stills (Imagine / Craft / sharp) start after
    // the body is on the wire — waitUntil before json held generate ~127s.
    res.status(201).json(campaign);
    svc.drainStillsInBackground(campaign.id, stillsJobIds);
  } catch (err) {
    if (!res.headersSent) return handleError(err, res);
    logger.error({ err }, "Campaign generate error after response");
  }
});

// GET /api/campaigns
router.get("/", async (req, res) => {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(401).json({ error: "token required" });

  const authResult = await verifyToken(token);
  if (!authResult) return res.status(401).json({ error: "invalid or expired token" });

  try {
    const summaries = await svc.listCampaignsForUser(authResult.userId);
    return res.json(summaries);
  } catch (err) {
    return handleError(err, res);
  }
});

// GET /api/campaigns/:id
router.get("/:id", async (req, res) => {
  try {
    return res.json(await svc.getCampaign(req.params.id));
  } catch (err) {
    return handleError(err, res);
  }
});

// POST /api/campaigns/:id/render-stills — drain this campaign's stills jobs.
// Generate returns copy first; this keeps photography alive on Vercel Hobby
// after the 201. Does not spend ads. ADS_MODE is untouched.
router.post("/:id/render-stills", async (req, res) => {
  try {
    const result = await svc.renderCampaignStills(req.params.id);
    return res.json(result);
  } catch (err) {
    return handleError(err, res);
  }
});

// POST /api/campaigns/:id/revise
router.post("/:id/revise", async (req, res) => {
  const { request } = req.body as { request?: string };
  try {
    return res.json(await svc.reviseCampaignById(req.params.id, request ?? ""));
  } catch (err) {
    return handleError(err, res);
  }
});

// POST /api/campaigns/:id/publish
router.post("/:id/publish", async (req, res) => {
  const { dailyBudgetCents, metaSharePct, tiktokSharePct, googleSharePct, successUrl } =
    req.body as {
      dailyBudgetCents?: number;
      metaSharePct?: number;
      tiktokSharePct?: number;
      googleSharePct?: number;
      successUrl?: string | null;
    };
  try {
    const result = await svc.publishCampaignById(req.params.id, {
      dailyBudgetCents: dailyBudgetCents as number,
      metaSharePct: metaSharePct as number,
      tiktokSharePct: tiktokSharePct as number,
      googleSharePct: resolveGoogleSharePct(metaSharePct as number, tiktokSharePct as number, googleSharePct),
      successUrl,
    });
    return res.json(result);
  } catch (err) {
    return handleError(err, res);
  }
});

// POST /api/campaigns/:id/test-publish — bypass Stripe.
// Safe in mock (MockAdPlatform, no spend). Disabled only when production AND live.
router.post("/:id/test-publish", async (req, res) => {
  if (process.env.NODE_ENV === "production" && adsMode() === "live") {
    return res.status(403).json({ error: "test-publish is disabled in production" });
  }

  const { dailyBudgetCents, metaSharePct, tiktokSharePct, googleSharePct } = req.body as {
    dailyBudgetCents?: number;
    metaSharePct?: number;
    tiktokSharePct?: number;
    googleSharePct?: number;
  };

  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  if (!campaign) return res.status(404).json({ error: "not found" });
  if (!campaign.campaignJson) {
    return res.status(400).json({ error: "campaign not generated yet" });
  }

  let result;
  try {
    result = await publishCampaignToPlatforms(req.params.id, {
      dailyBudgetCents: dailyBudgetCents ?? 7500,
      metaSharePct: metaSharePct ?? 40,
      tiktokSharePct: tiktokSharePct ?? 30,
      googleSharePct: resolveGoogleSharePct(metaSharePct ?? 40, tiktokSharePct ?? 30, googleSharePct),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, campaignId: req.params.id }, "test-publish failed");
    return res.status(500).json({ error: message });
  }

  const fresh = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, req.params.id),
  });
  return res.json({
    adsMode: process.env.ADS_MODE ?? "mock",
    live: result.live,
    outcomes: result.outcomes,
    campaign: svc.toCampaignResponse(fresh!),
  });
});

// POST /api/campaigns/:id/pause
router.post("/:id/pause", async (req, res) => {
  try {
    return res.json(await svc.pauseCampaignById(req.params.id));
  } catch (err) {
    return handleError(err, res);
  }
});

// GET /api/campaigns/:id/metrics
router.get("/:id/metrics", async (req, res) => {
  try {
    return res.json(await svc.getCampaignMetrics(req.params.id));
  } catch (err) {
    return handleError(err, res);
  }
});

// GET /api/campaigns/:id/status
router.get("/:id/status", async (req, res) => {
  try {
    return res.json(await svc.getCampaignStatus(req.params.id));
  } catch (err) {
    return handleError(err, res);
  }
});

export default router;
