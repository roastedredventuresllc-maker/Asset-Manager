import type { AdPlatform, PublishInput, PublishResult, Metrics } from "./types.js";

const NOT_IMPLEMENTED =
  "Live publishing to LinkedIn Ads is not yet implemented. Keep ADS_MODE=mock, " +
  "or publish via Meta/TikTok. Connect LinkedIn in the admin Connectors section to prepare credentials.";

/**
 * Live LinkedIn Ads platform. The factory recognizes LinkedIn so it can be
 * connected and surfaced in the admin Connectors UI, but the deep
 * campaign-publishing implementation is intentionally out of scope for now and
 * each method fails loudly rather than silently no-op'ing.
 */
export class LinkedInAdPlatform implements AdPlatform {
  async publishCampaign(_input: PublishInput): Promise<PublishResult> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async pauseCampaign(_externalCampaignId: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async resumeCampaign(_externalCampaignId: string): Promise<void> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async getMetrics(_externalCampaignId: string): Promise<Metrics> {
    throw new Error(NOT_IMPLEMENTED);
  }
}
