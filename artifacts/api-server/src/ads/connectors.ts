import type { AdPlatformId } from "./types.js";
import { credentialState } from "./credentials.js";

/**
 * Static, in-code description of each ad-platform connector. This is the single
 * source of truth the admin "Connectors" UI and the status endpoint both read.
 *
 * Connection is credential-based: an operator either enters the required secrets
 * in the admin Connectors UI (encrypted at rest in `platform_credentials`) or
 * sets them in the Replit Secrets pane (the same secrets the live ad-platform
 * clients consume). The status endpoint reflects their presence. We never read,
 * return, or log secret VALUES — only whether each key is set.
 */
export interface ConnectorSpec {
  id: AdPlatformId;
  label: string;
  blurb: string;
  note: string | null;
  requiredSecretKeys: string[];
  optionalSecretKeys: string[];
  setupSteps: string[];
  docsUrl: string;
}

export interface ConnectorStatus extends ConnectorSpec {
  connected: boolean;
  missingKeys: string[];
  optionalPresentKeys: string[];
  // key names whose values are stored (encrypted) in the DB, never the values
  storedKeys: string[];
  // where the connected credentials come from, for the admin UI
  source: "stored" | "env" | "none";
}

export const CONNECTOR_SPECS: ConnectorSpec[] = [
  {
    id: "meta",
    label: "Meta (Facebook & Instagram)",
    blurb:
      "Publish to Facebook and Instagram feeds, stories and reels through the Meta Marketing API.",
    note: "Requires an approved Meta Business account with a system-user token.",
    requiredSecretKeys: [
      "META_SYSTEM_USER_TOKEN",
      "META_BUSINESS_ID",
      "META_DEFAULT_PAGE_ID",
    ],
    optionalSecretKeys: [],
    setupSteps: [
      "Open business.facebook.com, create or select your Business and note its Ad Account ID (digits only).",
      "Under Business Settings → Users → System Users, create a system user and generate a token with the ads_management and pages_read_engagement permissions.",
      "Connect the Facebook Page you advertise from and copy its Page ID.",
      "Add META_SYSTEM_USER_TOKEN, META_BUSINESS_ID and META_DEFAULT_PAGE_ID in the Replit Secrets pane, then press Refresh status.",
    ],
    docsUrl: "https://developers.facebook.com/docs/marketing-apis/",
  },
  {
    id: "tiktok",
    label: "TikTok Ads",
    blurb:
      "Publish in-feed video and image ads through the TikTok for Business Marketing API.",
    note: "Requires an approved TikTok Marketing API app and Business Center access.",
    requiredSecretKeys: [
      "TIKTOK_ACCESS_TOKEN",
      "TIKTOK_BC_ID",
      "TIKTOK_ADVERTISER_ID",
      "TIKTOK_IDENTITY_ID",
    ],
    optionalSecretKeys: [],
    setupSteps: [
      "Apply for the Marketing API at business-api.tiktok.com and create an app.",
      "Authorize the app for your Business Center and Advertiser account to obtain a long-lived access token.",
      "Note your Business Center ID, Advertiser ID and a verified Identity ID.",
      "Add TIKTOK_ACCESS_TOKEN, TIKTOK_BC_ID, TIKTOK_ADVERTISER_ID and TIKTOK_IDENTITY_ID in the Replit Secrets pane, then press Refresh status.",
    ],
    docsUrl: "https://business-api.tiktok.com/portal/docs",
  },
  {
    id: "google",
    label: "Google Ads",
    blurb:
      "Publish to the Google Display and Search networks through the Google Ads API.",
    note: "Google Ads requires a separately approved developer token in addition to OAuth credentials.",
    requiredSecretKeys: [
      "GOOGLE_ADS_DEVELOPER_TOKEN",
      "GOOGLE_ADS_CLIENT_ID",
      "GOOGLE_ADS_CLIENT_SECRET",
      "GOOGLE_ADS_REFRESH_TOKEN",
      "GOOGLE_ADS_CUSTOMER_ID",
    ],
    optionalSecretKeys: ["GOOGLE_ADS_LOGIN_CUSTOMER_ID"],
    setupSteps: [
      "In your Google Ads Manager account, open the API Center and apply for a developer token.",
      "Create OAuth client credentials in Google Cloud Console and generate a refresh token for the https://www.googleapis.com/auth/adwords scope.",
      "Note the target Customer ID (and the Manager / login Customer ID if you publish through a manager account).",
      "Add GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN and GOOGLE_ADS_CUSTOMER_ID in the Replit Secrets pane, then press Refresh status.",
    ],
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
  },
  {
    id: "linkedin",
    label: "LinkedIn Ads",
    blurb:
      "Publish sponsored content to the LinkedIn feed through the Marketing Developer Platform.",
    note: "Requires Marketing Developer Platform access, which LinkedIn approves per app.",
    requiredSecretKeys: [
      "LINKEDIN_ACCESS_TOKEN",
      "LINKEDIN_AD_ACCOUNT_ID",
      "LINKEDIN_ORGANIZATION_ID",
    ],
    optionalSecretKeys: [],
    setupSteps: [
      "Create an app in the LinkedIn Developer Portal and request Marketing Developer Platform (Advertising API) access.",
      "Complete OAuth to generate an access token with the r_ads, rw_ads and r_ads_reporting scopes.",
      "Note your Ad Account ID and the Organization URN you advertise on behalf of.",
      "Add LINKEDIN_ACCESS_TOKEN, LINKEDIN_AD_ACCOUNT_ID and LINKEDIN_ORGANIZATION_ID in the Replit Secrets pane, then press Refresh status.",
    ],
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
  },
];

/** Current ad-publishing mode. Defaults to the safe "mock" mode. */
export function adsMode(): string {
  return process.env.ADS_MODE ?? "mock";
}

/**
 * Compute connection status for every connector from its stored (encrypted, in
 * the DB) and environment credentials. Returns only key NAMES and booleans —
 * never secret values.
 */
export async function connectorStatuses(): Promise<ConnectorStatus[]> {
  return Promise.all(
    CONNECTOR_SPECS.map(async (spec) => {
      const state = await credentialState(
        spec.id,
        spec.requiredSecretKeys,
        spec.optionalSecretKeys,
      );
      return { ...spec, ...state };
    }),
  );
}
