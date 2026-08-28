import { resolveCredentials } from "./credentials.js";
import { CONNECTOR_SPECS, adsMode } from "./connectors.js";
import { authenticateGoogleAds } from "./google.js";
import { normalizeMetaAdAccountId } from "./metaAccount.js";
import { logger } from "../lib/logger.js";

export interface ConnectorVerifyResult {
  ok: boolean;
  platform: string;
  adsMode: string;
  identity?: Record<string, string | undefined>;
  error?: string;
}

function keysFor(platform: string): string[] {
  const spec = CONNECTOR_SPECS.find((s) => s.id === platform);
  return spec ? [...spec.requiredSecretKeys, ...spec.optionalSecretKeys] : [];
}

/**
 * Read-only authenticate/configure. Never publishes, never spends, never
 * writes ADS_MODE. Safe to call while ADS_MODE=mock.
 */
export async function verifyConnector(platform: string): Promise<ConnectorVerifyResult> {
  const mode = adsMode();
  const spec = CONNECTOR_SPECS.find((s) => s.id === platform);
  if (!spec || !spec.v1) {
    return { ok: false, platform, adsMode: mode, error: "Unknown or out-of-scope connector." };
  }

  const { values } = await resolveCredentials(platform, keysFor(platform));
  const missing = spec.requiredSecretKeys.filter((k) => !values[k]);
  if (missing.length > 0) {
    return {
      ok: false,
      platform,
      adsMode: mode,
      error: `Missing keys: ${missing.join(", ")}`,
    };
  }

  try {
    if (platform === "google") {
      const identity = await authenticateGoogleAds(values);
      return {
        ok: true,
        platform,
        adsMode: mode,
        identity: {
          customerId: identity.customerId,
          descriptiveName: identity.descriptiveName,
        },
      };
    }

    if (platform === "meta") {
      const token = values.META_SYSTEM_USER_TOKEN!;
      const adAccountId = normalizeMetaAdAccountId(values.META_BUSINESS_ID);
      const res = await fetch(
        `https://graph.facebook.com/v21.0/act_${adAccountId}?fields=id,name,account_status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        throw new Error(`Meta ${res.status}`);
      }
      const json = (await res.json()) as { id?: string; name?: string };
      return {
        ok: true,
        platform,
        adsMode: mode,
        identity: { adAccountId: json.id, name: json.name },
      };
    }

    if (platform === "tiktok") {
      const token = values.TIKTOK_ACCESS_TOKEN!;
      const advertiserId = values.TIKTOK_ADVERTISER_ID!;
      const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/advertiser/info/", {
        method: "GET",
        headers: { "Access-Token": token, "Content-Type": "application/json" },
      });
      // TikTok advertiser/info typically wants a POST body; try GET then POST.
      if (!res.ok) {
        const post = await fetch("https://business-api.tiktok.com/open_api/v1.3/advertiser/info/", {
          method: "POST",
          headers: { "Access-Token": token, "Content-Type": "application/json" },
          body: JSON.stringify({ advertiser_ids: [advertiserId] }),
        });
        const json = (await post.json()) as { code?: number; message?: string };
        if (!post.ok || json.code !== 0) {
          throw new Error(json.message ?? `TikTok ${post.status}`);
        }
        return { ok: true, platform, adsMode: mode, identity: { advertiserId } };
      }
      return { ok: true, platform, adsMode: mode, identity: { advertiserId } };
    }

    return { ok: false, platform, adsMode: mode, error: "Unsupported platform." };
  } catch (err) {
    logger.warn({ err, platform }, "Connector verify failed");
    return {
      ok: false,
      platform,
      adsMode: mode,
      error: "Could not authenticate. Check the credentials — values are never logged.",
    };
  }
}
