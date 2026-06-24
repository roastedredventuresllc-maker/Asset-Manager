import type { AdPlatform, AdPlatformId } from "./types.js";
import { MockAdPlatform } from "./mock.js";
import { MetaAdPlatform } from "./meta.js";
import { TikTokAdPlatform } from "./tiktok.js";
import { GoogleAdsAdPlatform } from "./google.js";
import { LinkedInAdPlatform } from "./linkedin.js";
import { CONNECTOR_SPECS } from "./connectors.js";
import { resolveCredentials } from "./credentials.js";

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

/** All credential key names (required + optional) declared for a platform. */
function keysFor(platform: AdPlatformId): string[] {
  const spec = CONNECTOR_SPECS.find((s) => s.id === platform);
  return spec ? [...spec.requiredSecretKeys, ...spec.optionalSecretKeys] : [];
}

/**
 * Build the ad-platform client. Defaults to the safe "mock" mode. In live mode
 * the resolved credentials (stored in the DB, else the environment) are injected
 * into the client so nothing reads process.env directly at publish time.
 */
export async function getAdPlatform(platform: AdPlatformId): Promise<AdPlatform> {
  const mode = process.env.ADS_MODE ?? "mock";
  if (mode === "mock") {
    return new MockAdPlatform(platform);
  }
  switch (platform) {
    case "meta": {
      const { values } = await resolveCredentials("meta", keysFor("meta"));
      return new MetaAdPlatform(values);
    }
    case "tiktok": {
      const { values } = await resolveCredentials("tiktok", keysFor("tiktok"));
      return new TikTokAdPlatform(values);
    }
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
