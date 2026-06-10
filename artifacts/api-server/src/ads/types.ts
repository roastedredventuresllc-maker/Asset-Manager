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
  tagline: string;
  landingUrl: string;
  dailyBudgetCents: number;
  audience: AudienceSpec;
  ads: CampaignAd[];
  pageId?: string;
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
  getMetrics(externalCampaignId: string): Promise<Metrics>;
}
