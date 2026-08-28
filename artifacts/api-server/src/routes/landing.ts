import { Router } from "express";
import { db, campaignsTable, adAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { buildLandingHtml, pickLandingPhoto, type LandingCampaign } from "../lib/landingPage.js";

const router = Router();

// GET /p/:slug — server-rendered landing page
router.get("/:slug", async (req, res) => {
  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.landingSlug, req.params.slug),
  });

  if (!campaign || !campaign.campaignJson) {
    return res.status(404).send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>Not Found</title></head>
<body style="background:#161310;color:#c4b8a8;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Georgia,serif;">
<p style="opacity:0.7;font-size:16px;">Page not found.</p>
</body></html>`);
  }

  const assets = await db.query.adAssetsTable.findMany({
    where: eq(adAssetsTable.campaignId, campaign.id),
  });
  const productImg = pickLandingPhoto(
    campaign.productImageUrl,
    assets.map((a) => ({ idx: a.idx, status: a.status, imageUrl: a.imageUrl })),
  );

  const fwdProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim();
  const proto = fwdProto || req.protocol || "https";
  const fwdHost = String(req.headers["x-forwarded-host"] ?? "").split(",")[0]?.trim();
  const host = fwdHost || req.headers.host || "";
  const canonical = host
    ? `${proto}://${host}/p/${encodeURIComponent(req.params.slug)}`
    : "";

  const html = buildLandingHtml({
    slug: req.params.slug,
    campaign: campaign.campaignJson as LandingCampaign,
    productImg,
    canonical,
  });

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (!productImg) {
    res.setHeader("X-Robots-Tag", "noindex");
  }
  return res.send(html);
});

export default router;
