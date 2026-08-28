import type { AdPlatform, AdPlatformId } from "./types.js";
import { MockAdPlatform } from "./mock.js";
import { MetaAdPlatform } from "./meta.js";
import { TikTokAdPlatform } from "./tiktok.js";
import { GoogleAdsAdPlatform } from "./google.js";
import { LinkedInAdPlatform } from "./linkedin.js";
import { CONNECTOR_SPECS, adsMode } from "./connectors.js";
import { resolveCredentials, type CredentialValues } from "./credentials.js";
import {
  applyAccountOverlay,
  houseIdsFromCredentials,
  parseClientAccountIds,
  parsePublishedSnapshot,
  selectPublishTarget,
  type PublicAccountTarget,
  type SelectedPublishTarget,
} from "./accountTarget.js";
import { loadClientAdAccount } from "./clientAccounts.js";

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
  V1_PLATFORM_IDS,
  type ConnectorSpec,
  type ConnectorStatus,
} from "./connectors.js";

/** All credential key names (required + optional) declared for a platform. */
function keysFor(platform: AdPlatformId): string[] {
  const spec = CONNECTOR_SPECS.find((s) => s.id === platform);
  return spec ? [...spec.requiredSecretKeys, ...spec.optionalSecretKeys] : [];
}

export type CampaignAccountContext = {
  id: string;
  userId: string | null;
  isHouseTest?: boolean | null;
  adAccountJson?: unknown;
  publishedAccountJson?: unknown;
};

async function loadHouseIds() {
  const [meta, tiktok, google] = await Promise.all([
    resolveCredentials("meta", keysFor("meta")),
    resolveCredentials("tiktok", keysFor("tiktok")),
    resolveCredentials("google", keysFor("google")),
  ]);
  return houseIdsFromCredentials({
    meta: meta.values,
    tiktok: tiktok.values,
    google: google.values,
  });
}

/**
 * Resolve per-customer (or house-test) account IDs for one campaign + platform.
 * Client brands never receive house account IDs.
 */
export async function resolveCampaignAccountTarget(
  platform: AdPlatformId,
  campaign: CampaignAccountContext,
  opts?: { allowUnclaimedHouse?: boolean; useSnapshot?: boolean },
): Promise<SelectedPublishTarget> {
  const house = await loadHouseIds();
  const client = await loadClientAdAccount(campaign.userId);
  return selectPublishTarget({
    isHouseTest: campaign.isHouseTest === true,
    userId: campaign.userId,
    allowUnclaimedHouse: opts?.allowUnclaimedHouse === true,
    client,
    campaignOverride: parseClientAccountIds(campaign.adAccountJson),
    publishedSnapshot:
      opts?.useSnapshot === false ? null : parsePublishedSnapshot(campaign.publishedAccountJson),
    house,
    adsMode: adsMode(),
    platform,
  });
}

export function publicTargetFromSelected(selected: SelectedPublishTarget): PublicAccountTarget {
  return selected.publicTarget;
}

/**
 * Build the ad-platform client. Defaults to the safe "mock" mode. In live mode
 * the resolved credentials (stored in the DB, else the environment) are injected
 * into the client so nothing reads process.env directly at publish time.
 *
 * `overlay` may replace client-owned account IDs only (Ad Account / advertiser /
 * Customer ID). House tokens, TikTok BC, and Google MCC login-customer-id stay.
 */
export async function getAdPlatform(
  platform: AdPlatformId,
  overlay?: CredentialValues,
): Promise<AdPlatform> {
  const mode = process.env.ADS_MODE ?? "mock";
  if (mode === "mock") {
    return new MockAdPlatform(platform);
  }
  switch (platform) {
    case "meta": {
      const { values } = await resolveCredentials("meta", keysFor("meta"));
      return new MetaAdPlatform(applyAccountOverlay("meta", values, overlay ?? {}));
    }
    case "tiktok": {
      const { values } = await resolveCredentials("tiktok", keysFor("tiktok"));
      return new TikTokAdPlatform(applyAccountOverlay("tiktok", values, overlay ?? {}));
    }
    case "google": {
      const { values } = await resolveCredentials("google", keysFor("google"));
      return new GoogleAdsAdPlatform(applyAccountOverlay("google", values, overlay ?? {}));
    }
    case "linkedin":
      return new LinkedInAdPlatform();
    default: {
      const exhaustive: never = platform;
      throw new Error(`Unknown ad platform: ${String(exhaustive)}`);
    }
  }
}

/** Campaign-aware client: mock still does not spend; live uses client IDs not house. */
export async function getAdPlatformForCampaign(
  platform: AdPlatformId,
  campaign: CampaignAccountContext,
  opts?: { allowUnclaimedHouse?: boolean; useSnapshot?: boolean },
): Promise<{ adPlatform: AdPlatform; target: SelectedPublishTarget }> {
  const target = await resolveCampaignAccountTarget(platform, campaign, opts);
  const adPlatform = await getAdPlatform(platform, target.overlay);
  return { adPlatform, target };
}
