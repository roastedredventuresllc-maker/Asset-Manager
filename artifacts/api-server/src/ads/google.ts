import type { AdPlatform, PublishInput, PublishResult, Metrics } from "./types.js";
import { logger } from "../lib/logger.js";
import { normalizeGoogleCustomerId } from "./googleCustomer.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ADS_API = "https://googleads.googleapis.com/v19";

export type GoogleAdsCredentials = Record<string, string | undefined>;

export { normalizeGoogleCustomerId } from "./googleCustomer.js";

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface SearchResponse {
  results?: Array<{
    customer?: { id?: string; descriptiveName?: string; currencyCode?: string };
    campaign?: { id?: string; resourceName?: string };
    metrics?: { impressions?: string; clicks?: string; costMicros?: string };
  }>;
  error?: { message?: string; status?: string };
}

interface MutateResponse {
  results?: Array<{ resourceName?: string }>;
  error?: { message?: string };
}

async function getAccessToken(creds: GoogleAdsCredentials): Promise<string> {
  const clientId = creds.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = creds.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = creds.GOOGLE_ADS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Ads OAuth credentials are incomplete");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Google OAuth token exchange failed${json.error ? `: ${json.error}` : ""}`,
    );
  }
  return json.access_token;
}

function adsHeaders(creds: GoogleAdsCredentials, accessToken: string): Record<string, string> {
  const developerToken = creds.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN not set");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  const login = normalizeGoogleCustomerId(creds.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  if (login) headers["login-customer-id"] = login;
  return headers;
}

async function adsFetch<T>(
  creds: GoogleAdsCredentials,
  accessToken: string,
  path: string,
  body?: object,
): Promise<T> {
  const customerId = normalizeGoogleCustomerId(creds.GOOGLE_ADS_CUSTOMER_ID);
  if (!customerId) throw new Error("GOOGLE_ADS_CUSTOMER_ID not set");
  const url = path.startsWith("http") ? path : `${ADS_API}/customers/${customerId}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: adsHeaders(creds, accessToken),
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  let json: T & { error?: { message?: string; status?: string } };
  try {
    json = JSON.parse(raw) as T & { error?: { message?: string; status?: string } };
  } catch {
    throw new Error(`Google Ads API error ${res.status}: ${raw.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Google Ads API error ${res.status}: ${json.error?.message ?? raw.slice(0, 200)}`);
  }
  if (json.error?.message) {
    throw new Error(`Google Ads API error: ${json.error.message}`);
  }
  return json;
}

export interface GoogleAdsIdentity {
  customerId: string;
  descriptiveName?: string;
  currencyCode?: string;
}

/**
 * Read-only authenticate/configure. Does not create campaigns or spend.
 */
export async function authenticateGoogleAds(
  creds: GoogleAdsCredentials,
): Promise<GoogleAdsIdentity> {
  const customerId = normalizeGoogleCustomerId(creds.GOOGLE_ADS_CUSTOMER_ID);
  if (!customerId) throw new Error("GOOGLE_ADS_CUSTOMER_ID not set");
  const accessToken = await getAccessToken(creds);
  const search = await adsFetch<SearchResponse>(creds, accessToken, "/googleAds:search", {
    query: "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
  });
  const row = search.results?.[0]?.customer;
  return {
    customerId: row?.id ?? customerId,
    descriptiveName: row?.descriptiveName,
    currencyCode: row?.currencyCode,
  };
}

export class GoogleAdsAdPlatform implements AdPlatform {
  constructor(private creds: GoogleAdsCredentials) {}

  async publishCampaign(input: PublishInput): Promise<PublishResult> {
    const customerId = normalizeGoogleCustomerId(this.creds.GOOGLE_ADS_CUSTOMER_ID);
    if (!customerId) throw new Error("GOOGLE_ADS_CUSTOMER_ID not set");
    const accessToken = await getAccessToken(this.creds);

    const budgetMicros = String(Math.max(input.dailyBudgetCents, 100) * 10_000);

    const budgetRes = await adsFetch<MutateResponse>(this.creds, accessToken, "/campaignBudgets:mutate", {
      operations: [
        {
          create: {
            name: `${input.campaignName ?? input.brandName} budget`,
            amountMicros: budgetMicros,
            deliveryMethod: "STANDARD",
            explicitlyShared: false,
          },
        },
      ],
    });
    const budgetName = budgetRes.results?.[0]?.resourceName;
    if (!budgetName) throw new Error("Google Ads: failed to create campaign budget");

    const campaignRes = await adsFetch<MutateResponse>(this.creds, accessToken, "/campaigns:mutate", {
      operations: [
        {
          create: {
            name: input.campaignName ?? `LaunchPad — ${input.brandName}`,
            status: "ENABLED",
            advertisingChannelType: "DISPLAY",
            campaignBudget: budgetName,
            targetSpend: {},
            containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
            networkSettings: {
              targetGoogleSearch: false,
              targetSearchNetwork: false,
              targetContentNetwork: true,
              targetPartnerSearchNetwork: false,
            },
          },
        },
      ],
    });
    const campaignName = campaignRes.results?.[0]?.resourceName;
    if (!campaignName) throw new Error("Google Ads: failed to create campaign");
    const campaignId = campaignName.split("/").pop() ?? "";

    const adGroupRes = await adsFetch<MutateResponse>(this.creds, accessToken, "/adGroups:mutate", {
      operations: [
        {
          create: {
            name: `${input.brandName} Ad Group`,
            campaign: campaignName,
            status: "ENABLED",
          },
        },
      ],
    });
    const adGroupName = adGroupRes.results?.[0]?.resourceName;
    if (!adGroupName) throw new Error("Google Ads: failed to create ad group");
    const adGroupId = adGroupName.split("/").pop() ?? "";

    const firstAd = input.ads[0];
    if (!firstAd) throw new Error("No ads to publish");

    let assetName: string | undefined;
    if (firstAd.imageUrl) {
      const imgRes = await fetch(firstAd.imageUrl);
      if (imgRes.ok) {
        const bytes = Buffer.from(await imgRes.arrayBuffer());
        const assetRes = await adsFetch<MutateResponse>(this.creds, accessToken, "/assets:mutate", {
          operations: [
            {
              create: {
                name: `launchpad_${input.campaignId}`,
                type: "IMAGE",
                imageAsset: { data: bytes.toString("base64") },
              },
            },
          ],
        });
        assetName = assetRes.results?.[0]?.resourceName;
      }
    }

    const headline = (firstAd.hook || input.brandName).slice(0, 30);
    const description = (firstAd.body || firstAd.hook || input.brandName).slice(0, 90);

    const adRes = await adsFetch<MutateResponse>(this.creds, accessToken, "/adGroupAds:mutate", {
      operations: [
        {
          create: {
            adGroup: adGroupName,
            status: "ENABLED",
            ad: {
              finalUrls: [input.landingUrl],
              responsiveDisplayAd: {
                headlines: [{ text: headline }],
                longHeadline: { text: (firstAd.hook || input.brandName).slice(0, 90) },
                descriptions: [{ text: description }],
                businessName: input.brandName.slice(0, 25),
                ...(assetName
                  ? {
                      marketingImages: [{ asset: assetName }],
                      squareMarketingImages: [{ asset: assetName }],
                    }
                  : {}),
              },
            },
          },
        },
      ],
    });
    const adName = adRes.results?.[0]?.resourceName ?? "";
    const adId = adName.split("/").pop() ?? "";

    logger.info({ campaignId, resourceName: campaignName }, "Google Ads campaign published");

    return {
      externalCampaignId: campaignId,
      externalAdSetId: adGroupId,
      externalAdId: adId,
    };
  }

  async pauseCampaign(externalCampaignId: string): Promise<void> {
    const customerId = normalizeGoogleCustomerId(this.creds.GOOGLE_ADS_CUSTOMER_ID);
    const accessToken = await getAccessToken(this.creds);
    await adsFetch<MutateResponse>(this.creds, accessToken, "/campaigns:mutate", {
      operations: [
        {
          update: {
            resourceName: `customers/${customerId}/campaigns/${externalCampaignId}`,
            status: "PAUSED",
          },
          updateMask: "status",
        },
      ],
    });
    logger.info({ externalCampaignId }, "Google Ads campaign paused");
  }

  async resumeCampaign(externalCampaignId: string): Promise<void> {
    const customerId = normalizeGoogleCustomerId(this.creds.GOOGLE_ADS_CUSTOMER_ID);
    const accessToken = await getAccessToken(this.creds);
    await adsFetch<MutateResponse>(this.creds, accessToken, "/campaigns:mutate", {
      operations: [
        {
          update: {
            resourceName: `customers/${customerId}/campaigns/${externalCampaignId}`,
            status: "ENABLED",
          },
          updateMask: "status",
        },
      ],
    });
    logger.info({ externalCampaignId }, "Google Ads campaign resumed");
  }

  async getMetrics(externalCampaignId: string): Promise<Metrics> {
    const accessToken = await getAccessToken(this.creds);
    const search = await adsFetch<SearchResponse>(this.creds, accessToken, "/googleAds:search", {
      query: `SELECT metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE campaign.id = ${externalCampaignId} AND segments.date DURING TODAY`,
    });
    const row = search.results?.[0]?.metrics ?? {};
    const costMicros = parseInt(row.costMicros ?? "0", 10);
    return {
      impressions: parseInt(row.impressions ?? "0", 10),
      clicks: parseInt(row.clicks ?? "0", 10),
      spendCents: Math.round(costMicros / 10_000),
    };
  }
}
