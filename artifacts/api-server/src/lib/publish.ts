import { db, campaignsTable, publishesTable, adAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAdPlatform } from "../ads/index.js";
import { generateId } from "./ids.js";
import { logger } from "./logger.js";
import type { CampaignData } from "./claude.js";

export interface PublishOptions {
  dailyBudgetCents: number;
  metaSharePct: number;
  tiktokSharePct: number;
}

export interface PublishOutcome {
  platform: "meta" | "tiktok";
  ok: boolean;
  externalCampaignId?: string;
  error?: string;
}

function resolveDomain(): string {
  return (
    process.env.REPLIT_DEV_DOMAIN ??
    process.env.REPLIT_DOMAINS?.split(",")[0] ??
    "localhost:3000"
  );
}

/**
 * Publish a generated campaign to the configured ad platforms and record the
 * results. Shared by the Stripe checkout webhook (real flow) and the dev-only
 * test-publish endpoint. Honors ADS_MODE (mock by default). Marks the campaign
 * "live" if at least one platform succeeds.
 */
export async function publishCampaignToPlatforms(
  campaignId: string,
  opts: PublishOptions,
): Promise<{ live: boolean; outcomes: PublishOutcome[] }> {
  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.id, campaignId),
  });
  if (!campaign?.campaignJson) {
    throw new Error("campaign not generated yet");
  }

  const cj = campaign.campaignJson as CampaignData;
  const domain = resolveDomain();
  const landingUrl = campaign.landingSlug
    ? `https://${domain}/p/${campaign.landingSlug}`
    : `https://${domain}`;

  // Attach generated image URLs to each ad so platforms can use them.
  const assets = await db.query.adAssetsTable.findMany({
    where: eq(adAssetsTable.campaignId, campaignId),
  });
  const adsWithImages = cj.ads.map((ad, idx) => ({
    ...ad,
    imageUrl: assets.find((a) => a.idx === idx)?.imageUrl ?? null,
  }));

  const platforms: Array<"meta" | "tiktok"> = [];
  if (opts.metaSharePct > 0) platforms.push("meta");
  if (opts.tiktokSharePct > 0) platforms.push("tiktok");

  const outcomes: PublishOutcome[] = [];

  for (const platform of platforms) {
    const share = platform === "meta" ? opts.metaSharePct : opts.tiktokSharePct;
    const platformBudget = Math.round((opts.dailyBudgetCents * share) / 100);

    try {
      const adPlatform = getAdPlatform(platform);
      const result = await adPlatform.publishCampaign({
        campaignId,
        brandName: cj.brandName,
        tagline: cj.tagline ?? "",
        landingUrl,
        dailyBudgetCents: platformBudget,
        audience: cj.audience,
        ads: adsWithImages,
      });

      await db.insert(publishesTable).values({
        id: generateId("pub"),
        campaignId,
        platform,
        externalCampaignId: result.externalCampaignId,
        externalAdSetId: result.externalAdSetId,
        externalAdId: result.externalAdId,
        dailyBudgetCents: platformBudget,
        status: "active",
        publishedAt: new Date(),
      });

      outcomes.push({ platform, ok: true, externalCampaignId: result.externalCampaignId });
      logger.info({ campaignId, platform, result }, "Campaign published");
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      outcomes.push({ platform, ok: false, error });
      logger.error({ err, campaignId, platform }, "Failed to publish to platform");
    }
  }

  const live = outcomes.some((o) => o.ok);
  if (live) {
    await db
      .update(campaignsTable)
      .set({ status: "live" })
      .where(eq(campaignsTable.id, campaignId));
  }

  return { live, outcomes };
}
