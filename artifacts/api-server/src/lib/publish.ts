import { db, campaignsTable, publishesTable, adAssetsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAdPlatformForCampaign } from "../ads/index.js";
import { adsMode } from "../ads/connectors.js";
import { AccountIsolationError } from "../ads/accountTarget.js";
import { generateId } from "./ids.js";
import { logger } from "./logger.js";
import { resolveGoogleSharePct } from "./channelSplit.js";
import { publicOrigin } from "./assetUrl.js";
import { assertRunReadyCreative } from "./channelCreative.js";
import type { CampaignData } from "./claude.js";
import type { PublicAccountTarget } from "../ads/accountTarget.js";

export interface PublishOptions {
  dailyBudgetCents: number;
  metaSharePct: number;
  tiktokSharePct: number;
  googleSharePct?: number;
}

export interface PublishOutcome {
  platform: "meta" | "tiktok" | "google";
  ok: boolean;
  externalCampaignId?: string;
  error?: string;
  targetAccount?: PublicAccountTarget;
}

/**
 * Publish a generated campaign to the configured ad platforms and record the
 * results. Shared by admin approval and the dev-only test-publish endpoint.
 * Honors ADS_MODE (mock by default). Client brands publish to stored
 * per-customer account IDs; house env IDs are LaunchPad tests only.
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
  const origin = publicOrigin();
  const landingUrl = campaign.landingSlug
    ? `${origin}/p/${campaign.landingSlug}`
    : origin;

  let clientTag = "anon";
  if (campaign.userId) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, campaign.userId),
    });
    const emailLocal = user?.email
      ?.split("@")[0]
      ?.replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 24);
    clientTag = emailLocal || campaign.userId.slice(0, 12);
  }
  const platformCampaignName = `LP · ${clientTag} · ${campaignId} — ${cj.brandName}`;

  const assets = await db.query.adAssetsTable.findMany({
    where: eq(adAssetsTable.campaignId, campaignId),
  });
  const adsWithImages = cj.ads.map((ad, idx) => ({
    ...ad,
    imageUrl: assets.find((a) => a.idx === idx)?.imageUrl ?? null,
  }));

  const platforms: Array<"meta" | "tiktok" | "google"> = [];
  if (opts.metaSharePct > 0) platforms.push("meta");
  if (opts.tiktokSharePct > 0) platforms.push("tiktok");
  const googlePct = resolveGoogleSharePct(
    opts.metaSharePct,
    opts.tiktokSharePct,
    opts.googleSharePct,
  );
  if (googlePct > 0) platforms.push("google");

  const outcomes: PublishOutcome[] = [];
  const snapshot: PublicAccountTarget = {
    scope: campaign.isHouseTest ? "house" : "client",
  };

  // Anonymous founder prompts (no Stripe user) publish through house in mock,
  // including production mock. Live mode still requires a client assignment.
  const allowUnclaimedHouse =
    !campaign.userId && (process.env.NODE_ENV !== "production" || adsMode() !== "live");

  for (const platform of platforms) {
    const share =
      platform === "meta"
        ? opts.metaSharePct
        : platform === "tiktok"
          ? opts.tiktokSharePct
          : googlePct;
    const platformBudget = Math.round((opts.dailyBudgetCents * share) / 100);

    try {
      const { adPlatform, target } = await getAdPlatformForCampaign(
        platform,
        campaign,
        { allowUnclaimedHouse, useSnapshot: false },
      );
      Object.assign(snapshot, target.publicTarget);
      snapshot.scope = target.scope;

      const result = await adPlatform.publishCampaign({
        campaignId,
        brandName: cj.brandName,
        campaignName: platformCampaignName,
        tagline: cj.tagline ?? "",
        landingUrl,
        dailyBudgetCents: platformBudget,
        audience: cj.audience,
        ads: assertRunReadyCreative(adsWithImages, platform),
        targetAccount: {
          scope: target.scope,
          metaAdAccountId: target.publicTarget.metaAdAccountId,
          tiktokAdvertiserId: target.publicTarget.tiktokAdvertiserId,
          googleCustomerId: target.publicTarget.googleCustomerId,
        },
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

      outcomes.push({
        platform,
        ok: true,
        externalCampaignId: result.externalCampaignId,
        targetAccount: target.publicTarget,
      });
      logger.info(
        { campaignId, platform, result, targetAccount: target.publicTarget },
        "Campaign published",
      );
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const code = err instanceof AccountIsolationError ? err.code : undefined;
      outcomes.push({ platform, ok: false, error });
      logger.error({ err, campaignId, platform, code }, "Failed to publish to platform");
    }
  }

  const live = outcomes.some((o) => o.ok);
  if (live) {
    await db
      .update(campaignsTable)
      .set({
        status: "live",
        pausedReason: null,
        publishedAccountJson: snapshot,
      })
      .where(eq(campaignsTable.id, campaignId));
  }

  return { live, outcomes };
}
