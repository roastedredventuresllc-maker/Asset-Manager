import type { AdPlatform, AdPlatformId, PublishInput, PublishResult, Metrics } from "./types.js";
import { logger } from "../lib/logger.js";

function deterministicNumber(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const val = Math.abs(h) % (max - min + 1) + min;
  return val;
}

export class MockAdPlatform implements AdPlatform {
  private platform: string;

  constructor(platform: AdPlatformId) {
    this.platform = platform;
  }

  async publishCampaign(input: PublishInput): Promise<PublishResult> {
    const result: PublishResult = {
      externalCampaignId: `mock_${this.platform}_campaign_${input.campaignId}`,
      externalAdSetId: `mock_${this.platform}_adset_${input.campaignId}`,
      externalAdId: `mock_${this.platform}_ad_${input.campaignId}`,
    };

    logger.info(
      {
        platform: this.platform,
        campaignId: input.campaignId,
        brandName: input.brandName,
        dailyBudgetCents: input.dailyBudgetCents,
        audience: input.audience,
        adCount: input.ads.length,
        landingUrl: input.landingUrl,
        result,
      },
      "[MOCK] publishCampaign — would send to platform API",
    );

    return result;
  }

  async pauseCampaign(externalCampaignId: string): Promise<void> {
    logger.info(
      { platform: this.platform, externalCampaignId },
      "[MOCK] pauseCampaign — would pause on platform API",
    );
  }

  async getMetrics(externalCampaignId: string): Promise<Metrics> {
    // Deterministic incrementing metrics seeded by campaign id
    const seed = externalCampaignId + Date.now().toString().slice(0, -4);
    const impressions = deterministicNumber(seed + "imp", 500, 8000);
    const clicks = deterministicNumber(seed + "clk", 10, Math.floor(impressions * 0.05));
    const spendCents = deterministicNumber(seed + "spd", 100, 500);

    return { impressions, clicks, spendCents };
  }
}
