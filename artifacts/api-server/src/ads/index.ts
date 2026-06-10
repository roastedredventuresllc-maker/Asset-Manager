import type { AdPlatform } from "./types.js";
import { MockAdPlatform } from "./mock.js";
import { MetaAdPlatform } from "./meta.js";
import { TikTokAdPlatform } from "./tiktok.js";

export type { AdPlatform, PublishInput, PublishResult, Metrics, CampaignAd, AudienceSpec } from "./types.js";

export function getAdPlatform(platform: "meta" | "tiktok"): AdPlatform {
  const mode = process.env.ADS_MODE ?? "mock";
  if (mode === "mock") {
    return new MockAdPlatform(platform);
  }
  if (platform === "meta") return new MetaAdPlatform();
  return new TikTokAdPlatform();
}
