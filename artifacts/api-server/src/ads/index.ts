import type { AdPlatform, AdPlatformId } from "./types.js";
import { MockAdPlatform } from "./mock.js";
import { MetaAdPlatform } from "./meta.js";
import { TikTokAdPlatform } from "./tiktok.js";
import { GoogleAdsAdPlatform } from "./google.js";
import { LinkedInAdPlatform } from "./linkedin.js";

export type {
  AdPlatform,
  AdPlatformId,
  PublishInput,
  PublishResult,
  Metrics,
  CampaignAd,
  AudienceSpec,
} from "./types.js";

export {
  CONNECTOR_SPECS,
  connectorStatuses,
  adsMode,
  type ConnectorSpec,
  type ConnectorStatus,
} from "./connectors.js";

export function getAdPlatform(platform: AdPlatformId): AdPlatform {
  const mode = process.env.ADS_MODE ?? "mock";
  if (mode === "mock") {
    return new MockAdPlatform(platform);
  }
  switch (platform) {
    case "meta":
      return new MetaAdPlatform();
    case "tiktok":
      return new TikTokAdPlatform();
    case "google":
      return new GoogleAdsAdPlatform();
    case "linkedin":
      return new LinkedInAdPlatform();
    default: {
      const exhaustive: never = platform;
      throw new Error(`Unknown ad platform: ${String(exhaustive)}`);
    }
  }
}
