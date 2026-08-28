import { db, campaignsTable, publishesTable, metricsSnapshotsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getAdPlatformForCampaign } from "../ads/index.js";
import { generateId } from "./ids.js";
import { pauseCampaignById, getLifetimeSpendCents } from "./campaignService.js";
import { logger } from "./logger.js";

/**
 * Spend guard: polls platform metrics for every live campaign, records
 * per-platform + total snapshots, and auto-pauses any campaign whose lifetime
 * spend has reached its budget cap. Metrics are fetched against the same
 * per-customer (or house-test) account the campaign was published to.
 */

export interface SpendGuardResult {
  checked: number;
  autoPaused: string[];
}

export async function runSpendGuardOnce(): Promise<SpendGuardResult> {
  const liveCampaigns = await db.query.campaignsTable.findMany({
    where: eq(campaignsTable.status, "live"),
  });

  const autoPaused: string[] = [];

  for (const campaign of liveCampaigns) {
    try {
      const publishes = await db.query.publishesTable.findMany({
        where: and(
          eq(publishesTable.campaignId, campaign.id),
          eq(publishesTable.status, "active"),
        ),
      });
      if (publishes.length === 0) continue;

      let totalImpressions = 0;
      let totalClicks = 0;
      let totalSpendCents = 0;
      let anyMetrics = false;

      for (const pub of publishes) {
        if (!pub.externalCampaignId) continue;
        try {
          const { adPlatform } = await getAdPlatformForCampaign(
            pub.platform as "meta" | "tiktok" | "google",
            campaign,
            { useSnapshot: true, allowUnclaimedHouse: !campaign.userId },
          );
          const m = await adPlatform.getMetrics(pub.externalCampaignId);
          anyMetrics = true;
          totalImpressions += m.impressions;
          totalClicks += m.clicks;
          totalSpendCents += m.spendCents;

          await db.insert(metricsSnapshotsTable).values({
            id: generateId("snap"),
            campaignId: campaign.id,
            platform: pub.platform,
            impressions: m.impressions,
            clicks: m.clicks,
            spendCents: m.spendCents,
          });
        } catch (err) {
          logger.warn(
            { err, campaignId: campaign.id, platform: pub.platform },
            "Spend guard: metrics fetch failed",
          );
        }
      }

      if (!anyMetrics) continue;

      await db.insert(metricsSnapshotsTable).values({
        id: generateId("snap"),
        campaignId: campaign.id,
        platform: "total",
        impressions: totalImpressions,
        clicks: totalClicks,
        spendCents: totalSpendCents,
      });

      if (campaign.budgetCapCents != null) {
        const lifetime = await getLifetimeSpendCents(campaign.id);
        if (lifetime >= campaign.budgetCapCents) {
          logger.warn(
            {
              campaignId: campaign.id,
              lifetimeSpendCents: lifetime,
              budgetCapCents: campaign.budgetCapCents,
            },
            "Spend guard: budget cap reached — auto-pausing campaign",
          );
          await pauseCampaignById(campaign.id, "budget_cap");
          autoPaused.push(campaign.id);
        }
      }
    } catch (err) {
      logger.error({ err, campaignId: campaign.id }, "Spend guard: campaign check failed");
    }
  }

  return { checked: liveCampaigns.length, autoPaused };
}

let running = false;

/** Start the in-process spend guard loop. Guards against overlapping runs. */
export function startSpendGuardLoop(intervalMs = 60_000): void {
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const result = await runSpendGuardOnce();
      if (result.autoPaused.length > 0) {
        logger.info(result, "Spend guard auto-paused campaigns");
      }
    } catch (err) {
      logger.error({ err }, "Spend guard loop error");
    } finally {
      running = false;
    }
  }, intervalMs);

  logger.info({ intervalMs }, "Spend guard started");
}
