import type { AdPlatform, PublishInput, PublishResult, Metrics } from "./types.js";
import { logger } from "../lib/logger.js";

const BASE = "https://graph.facebook.com/v21.0";

export type MetaCredentials = Record<string, string | undefined>;

export class MetaAdPlatform implements AdPlatform {
  constructor(private creds: MetaCredentials) {}

  private async fetch(path: string, method: string, body?: object): Promise<unknown> {
    const token = this.creds.META_SYSTEM_USER_TOKEN;
    if (!token) throw new Error("META_SYSTEM_USER_TOKEN not set");

    const url = path.startsWith("http") ? path : `${BASE}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Meta API error ${res.status}: ${err}`);
    }
    return res.json();
  }

  private async uploadImage(imageUrl: string, adAccountId: string): Promise<string> {
    const res = (await this.fetch(`/act_${adAccountId}/adimages`, "POST", {
      url: imageUrl,
    })) as { images: Record<string, { hash: string }> };
    const hash = Object.values(res.images)[0]?.hash;
    if (!hash) throw new Error("Failed to upload image to Meta");
    return hash;
  }

  async publishCampaign(input: PublishInput): Promise<PublishResult> {
    const adAccountId = this.creds.META_BUSINESS_ID;
    const pageId = this.creds.META_DEFAULT_PAGE_ID ?? input.pageId;
    if (!adAccountId || !pageId) throw new Error("META_BUSINESS_ID or META_DEFAULT_PAGE_ID not set");

    // 1. Create campaign
    const campaignRes = (await this.fetch(`/act_${adAccountId}/campaigns`, "POST", {
      name: input.campaignName ?? `LaunchPad — ${input.brandName}`,
      objective: "OUTCOME_TRAFFIC",
      status: "ACTIVE",
    })) as { id: string };

    // 2. Create ad set
    const adSetRes = (await this.fetch(`/act_${adAccountId}/adsets`, "POST", {
      name: `${input.brandName} Ad Set`,
      campaign_id: campaignRes.id,
      daily_budget: input.dailyBudgetCents,
      optimization_goal: "LINK_CLICKS",
      billing_event: "IMPRESSIONS",
      targeting: {
        age_min: input.audience.ageMin,
        age_max: input.audience.ageMax,
        interests: input.audience.interests.slice(0, 10).map((i) => ({ name: i })),
        geo_locations: { countries: [input.audience.geo.substring(0, 2).toUpperCase() || "US"] },
      },
      status: "ACTIVE",
    })) as { id: string };

    // 3. Upload first image and create ad creative
    const firstAd = input.ads[0];
    if (!firstAd) throw new Error("No ads to publish");

    let imageHash: string | undefined;
    if (firstAd.imageUrl) {
      imageHash = await this.uploadImage(firstAd.imageUrl, adAccountId);
    }

    const creativeRes = (await this.fetch(`/act_${adAccountId}/adcreatives`, "POST", {
      name: `${input.brandName} Creative`,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          link: input.landingUrl,
          message: firstAd.body,
          name: firstAd.hook,
          call_to_action: { type: "LEARN_MORE", value: { link: input.landingUrl } },
          ...(imageHash ? { image_hash: imageHash } : {}),
        },
      },
    })) as { id: string };

    // 4. Create ad
    const adRes = (await this.fetch(`/act_${adAccountId}/ads`, "POST", {
      name: `${input.brandName} Ad`,
      adset_id: adSetRes.id,
      creative: { creative_id: creativeRes.id },
      status: "ACTIVE",
    })) as { id: string };

    logger.info({ campaignId: campaignRes.id }, "Meta campaign published");

    return {
      externalCampaignId: campaignRes.id,
      externalAdSetId: adSetRes.id,
      externalAdId: adRes.id,
    };
  }

  async pauseCampaign(externalCampaignId: string): Promise<void> {
    await this.fetch(`/${externalCampaignId}`, "POST", { status: "PAUSED" });
    logger.info({ externalCampaignId }, "Meta campaign paused");
  }

  async resumeCampaign(externalCampaignId: string): Promise<void> {
    await this.fetch(`/${externalCampaignId}`, "POST", { status: "ACTIVE" });
    logger.info({ externalCampaignId }, "Meta campaign resumed");
  }

  async getMetrics(externalCampaignId: string): Promise<Metrics> {
    const res = (await this.fetch(
      `/${externalCampaignId}/insights?fields=impressions,clicks,spend&date_preset=today`,
      "GET",
    )) as { data: Array<{ impressions?: string; clicks?: string; spend?: string }> };

    const row = res.data[0] ?? {};
    return {
      impressions: parseInt(row.impressions ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
      spendCents: Math.round(parseFloat(row.spend ?? "0") * 100),
    };
  }
}
