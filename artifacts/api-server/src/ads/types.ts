export type AdPlatformId = "meta" | "tiktok" | "google" | "linkedin";

export interface CampaignAd {
  hook: string;
  body: string;
  cta: string;
  angle: string;
  imagePrompt: string;
  gradientHex1: string;
  gradientHex2: string;
  imageUrl?: string | null;
}

export interface AudienceSpec {
  ageMin: number;
  ageMax: number;
  interests: string[];
  geo: string;
}

export interface PublishInput {
  campaignId: string;
  brandName: string;
  /**
   * Full campaign name used on the ad platform. Client brands publish into
   * their own ad accounts; the prefix still tags the campaign for reporting.
   * Falls back to a brandName-based name when absent.
   */
  campaignName?: string;
  tagline: string;
  landingUrl: string;
  dailyBudgetCents: number;
  audience: AudienceSpec;
  ads: CampaignAd[];
  pageId?: string;
  /** Public account targeting (IDs only, never tokens) for mock logs and isolation. */
  targetAccount?: {
    scope: "house" | "client";
    metaAdAccountId?: string;
    tiktokAdvertiserId?: string;
    googleCustomerId?: string;
  };
}

export interface PublishResult {
  externalCampaignId: string;
  externalAdSetId: string;
  externalAdId: string;
}

export interface Metrics {
  impressions: number;
  clicks: number;
  spendCents: number;
}

export interface AdPlatform {
  publishCampaign(input: PublishInput): Promise<PublishResult>;
  pauseCampaign(externalCampaignId: string): Promise<void>;
  resumeCampaign(externalCampaignId: string): Promise<void>;
  getMetrics(externalCampaignId: string): Promise<Metrics>;
}
