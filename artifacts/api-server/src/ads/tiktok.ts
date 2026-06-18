import type { AdPlatform, PublishInput, PublishResult, Metrics } from "./types.js";
import { logger } from "../lib/logger.js";

const BASE = "https://business-api.tiktok.com/open_api/v1.3";

async function tiktokFetch(path: string, method: string, body?: object): Promise<unknown> {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) throw new Error("TIKTOK_ACCESS_TOKEN not set");

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Access-Token": token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TikTok API error ${res.status}: ${err}`);
  }
  const json = await res.json() as { code: number; message: string; data: unknown };
  if (json.code !== 0) throw new Error(`TikTok API error: ${json.message}`);
  return json.data;
}

async function uploadImage(imageUrl: string, advertiserId: string): Promise<string> {
  const res = await tiktokFetch("/file/image/ad/upload/", "POST", {
    advertiser_id: advertiserId,
    upload_type: "UPLOAD_BY_URL",
    image_url: imageUrl,
    file_name: `launchpad_${Date.now()}.png`,
  }) as { image_id: string };
  if (!res.image_id) throw new Error("Failed to upload image to TikTok");
  return res.image_id;
}

export class TikTokAdPlatform implements AdPlatform {
  async publishCampaign(input: PublishInput): Promise<PublishResult> {
    const bcId = process.env.TIKTOK_BC_ID;
    const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
    if (!bcId || !advertiserId) throw new Error("TIKTOK_BC_ID or TIKTOK_ADVERTISER_ID not set");

    // 1. Create campaign
    const campaignRes = await tiktokFetch("/campaign/create/", "POST", {
      advertiser_id: advertiserId,
      campaign_name: `LaunchPad — ${input.brandName}`,
      objective_type: "TRAFFIC",
      budget_mode: "BUDGET_MODE_INFINITE",
    }) as { campaign_id: string };

    // 2. Create ad group
    const adGroupRes = await tiktokFetch("/adgroup/create/", "POST", {
      advertiser_id: advertiserId,
      campaign_id: campaignRes.campaign_id,
      adgroup_name: `${input.brandName} Ad Group`,
      budget_mode: "BUDGET_MODE_DAY",
      budget: input.dailyBudgetCents / 100,
      schedule_type: "SCHEDULE_START_END",
      schedule_start_time: new Date().toISOString().slice(0, 19),
      schedule_end_time: new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 19),
      optimization_goal: "CLICK",
      billing_event: "CPC",
      targeting_expansion: { expansion_enabled: true },
    }) as { adgroup_id: string };

    // 3. Create the ad from the primary creative. We generate static images,
    // so the ad format is SINGLE_IMAGE; the image is uploaded first to obtain
    // an image_id. TikTok requires an identity for image ads.
    const firstAd = input.ads[0];
    if (!firstAd) throw new Error("No ads to publish");

    const identityId = process.env.TIKTOK_IDENTITY_ID;
    if (!identityId) throw new Error("TIKTOK_IDENTITY_ID not set");

    let imageId: string | undefined;
    if (firstAd.imageUrl) {
      imageId = await uploadImage(firstAd.imageUrl, advertiserId);
    }

    const adRes = await tiktokFetch("/ad/create/", "POST", {
      advertiser_id: advertiserId,
      adgroup_id: adGroupRes.adgroup_id,
      identity_type: "CUSTOMIZED_USER",
      identity_id: identityId,
      creatives: [
        {
          ad_name: `${input.brandName} Ad`,
          ad_format: "SINGLE_IMAGE",
          ad_text: firstAd.body,
          call_to_action: "LEARN_MORE",
          landing_page_url: input.landingUrl,
          ...(imageId ? { image_ids: [imageId] } : {}),
        },
      ],
    }) as { ad_ids?: string[]; ad_id?: string };

    const adId = adRes.ad_ids?.[0] ?? adRes.ad_id ?? "";

    logger.info({ campaignId: campaignRes.campaign_id }, "TikTok campaign published");

    return {
      externalCampaignId: campaignRes.campaign_id,
      externalAdSetId: adGroupRes.adgroup_id,
      externalAdId: adId,
    };
  }

  async pauseCampaign(externalCampaignId: string): Promise<void> {
    const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
    await tiktokFetch("/campaign/status/update/", "POST", {
      advertiser_id: advertiserId,
      campaign_ids: [externalCampaignId],
      opt_status: "DISABLE",
    });
    logger.info({ externalCampaignId }, "TikTok campaign paused");
  }

  async getMetrics(externalCampaignId: string): Promise<Metrics> {
    const advertiserId = process.env.TIKTOK_ADVERTISER_ID;
    const today = new Date().toISOString().slice(0, 10);

    const res = await tiktokFetch("/report/integrated/get/", "GET", {
      advertiser_id: advertiserId,
      report_type: "BASIC",
      dimensions: ["campaign_id"],
      filters: [{ field_name: "campaign_id", filter_type: "IN", filter_value: `["${externalCampaignId}"]` }],
      metrics: ["show_cnt", "click_cnt", "spend"],
      start_date: today,
      end_date: today,
    }) as { list: Array<{ metrics: { show_cnt?: string; click_cnt?: string; spend?: string } }> };

    const row = res.list?.[0]?.metrics ?? {};
    return {
      impressions: parseInt(row.show_cnt ?? "0", 10),
      clicks: parseInt(row.click_cnt ?? "0", 10),
      spendCents: Math.round(parseFloat(row.spend ?? "0") * 100),
    };
  }
}
