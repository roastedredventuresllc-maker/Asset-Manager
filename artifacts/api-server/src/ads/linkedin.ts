import type { AdPlatform, PublishInput, PublishResult, Metrics } from "./types.js";

const NOT_IMPLEMENTED =
  "LinkedIn Ads is out of v1 ship and is not implemented. v1 channels are Meta, TikTok, and Google.";

/**
 * Live LinkedIn Ads platform. LinkedIn is out of v1 ship — kept unimplemented
 * and hidden from the admin Connectors UI. Do not wire it into budget split.
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
