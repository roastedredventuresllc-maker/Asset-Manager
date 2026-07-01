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
/** A single setup instruction, optionally with a direct link to the exact page. */
export interface SetupStep {
  text: string;
  link?: { label: string; url: string };
}

export interface ConnectorSpec {
  id: AdPlatformId;
  label: string;
  blurb: string;
  note: string | null;
  requiredSecretKeys: string[];
  optionalSecretKeys: string[];
  setupSteps: SetupStep[];
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
      {
        text: "Open Business Settings → Accounts → Ad Accounts, select the ad account you advertise from, and copy its Ad Account ID (digits only) — that's META_BUSINESS_ID.",
        link: {
          label: "Open Ad Accounts",
          url: "https://business.facebook.com/settings/ad-accounts",
        },
      },
      {
        text: "Under Users → System Users, add a system user and generate a token with the ads_management and pages_read_engagement permissions. That token is META_SYSTEM_USER_TOKEN.",
        link: {
          label: "Open System Users",
          url: "https://business.facebook.com/settings/system-users",
        },
      },
      {
        text: "Open Pages, click the Page you advertise from, and copy its Page ID — that's META_DEFAULT_PAGE_ID.",
        link: {
          label: "Open Pages",
          url: "https://business.facebook.com/settings/pages",
        },
      },
      { text: "Paste the three values into the fields below and press Save." },
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
      {
        text: "Create a Marketing API app in the TikTok for Business developer portal.",
        link: {
          label: "Open developer portal",
          url: "https://business-api.tiktok.com/portal",
        },
      },
      {
        text: "Authorize the app for your Business Center and advertiser account to get a long-lived access token — that's TIKTOK_ACCESS_TOKEN.",
        link: {
          label: "Open Business Center",
          url: "https://business.tiktok.com",
        },
      },
      {
        text: "In Business Center, copy your Business Center ID (TIKTOK_BC_ID), Advertiser ID (TIKTOK_ADVERTISER_ID) and a verified Identity ID (TIKTOK_IDENTITY_ID).",
      },
      { text: "Paste the four values into the fields below and press Save." },
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
      {
        text: "In your Google Ads Manager account, open the API Center and apply for a developer token — that's GOOGLE_ADS_DEVELOPER_TOKEN.",
        link: {
          label: "Open API Center",
          url: "https://ads.google.com/aw/apicenter",
        },
      },
      {
        text: "In Google Cloud Console, create OAuth client credentials — those are GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET.",
        link: {
          label: "Open Cloud credentials",
          url: "https://console.cloud.google.com/apis/credentials",
        },
      },
      {
        text: "Use the OAuth Playground to generate a refresh token for the AdWords scope — that's GOOGLE_ADS_REFRESH_TOKEN.",
        link: {
          label: "Open OAuth Playground",
          url: "https://developers.google.com/oauthplayground",
        },
      },
      {
        text: "Copy the target account's Customer ID (GOOGLE_ADS_CUSTOMER_ID). Only if you publish through a manager account, also add its ID as GOOGLE_ADS_LOGIN_CUSTOMER_ID.",
      },
      { text: "Paste the values into the fields below and press Save." },
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
      {
        text: "Create an app in the LinkedIn Developer Portal and request Advertising API access.",
        link: {
          label: "Open Developer Portal",
          url: "https://www.linkedin.com/developers/apps",
        },
      },
      {
        text: "Complete OAuth to generate an access token with the r_ads, rw_ads and r_ads_reporting scopes — that's LINKEDIN_ACCESS_TOKEN.",
      },
      {
        text: "In Campaign Manager, copy your Ad Account ID (LINKEDIN_AD_ACCOUNT_ID) and the Organization ID you advertise on behalf of (LINKEDIN_ORGANIZATION_ID).",
        link: {
          label: "Open Campaign Manager",
          url: "https://www.linkedin.com/campaignmanager",
        },
      },
      { text: "Paste the three values into the fields below and press Save." },
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
