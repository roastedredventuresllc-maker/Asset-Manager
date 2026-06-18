import { anthropic as client } from "@workspace/integrations-anthropic-ai";

export interface CampaignAd {
  hook: string;
  body: string;
  cta: string;
  angle: string;
  imagePrompt: string;
  gradientHex1: string;
  gradientHex2: string;
}

export interface CampaignLanding {
  hero: string;
  sub: string;
  features: string[];
  socialProof: string;
  cta: string;
}

export interface CampaignData {
  brandName: string;
  tagline: string;
  category: string;
  palette: string[];
  audience: {
    ageMin: number;
    ageMax: number;
    interests: string[];
    geo: string;
  };
  channelSplit: {
    metaPct: number;
    tiktokPct: number;
    rationale: string;
  };
  recommendedBudgetPreset: "starter" | "growth" | "scale";
  ads: CampaignAd[];
  landing: CampaignLanding;
}

const GENERATE_SYSTEM = `You are a world-class performance marketing strategist and creative director. 
Given a product description, produce a complete ad campaign as strict JSON (no markdown, no explanation, just the JSON object).

The JSON must match this exact schema:
{
  "brandName": "string — derived from or created for the product",
  "tagline": "string — short, memorable tagline (6–10 words)",
  "category": "string — product category",
  "palette": ["#hex1","#hex2","#hex3","#hex4"],
  "audience": {
    "ageMin": number,
    "ageMax": number,
    "interests": ["string", ...],
    "geo": "US"
  },
  "channelSplit": {
    "metaPct": number,
    "tiktokPct": number,
    "rationale": "string — one sentence explaining the split"
  },
  "recommendedBudgetPreset": "starter" | "growth" | "scale",
  "ads": [
    {
      "hook": "5–8 word attention hook",
      "body": "10–15 word body copy",
      "cta": "2–4 word call to action",
      "angle": "strategic angle label (e.g. 'Social Proof', 'FOMO', 'Problem/Solution')",
      "imagePrompt": "detailed photographer's brief for image generation, 40–60 words, describes scene, lighting, composition, mood",
      "gradientHex1": "#hex",
      "gradientHex2": "#hex"
    },
    ... (exactly 3 ads total)
  ],
  "landing": {
    "hero": "5–8 word hero headline",
    "sub": "1–2 sentence subheadline",
    "features": ["feature 1", "feature 2", "feature 3"],
    "socialProof": "one social proof line (e.g. '10,000+ founders trust LaunchPad')",
    "cta": "call to action for landing page button"
  }
}

Rules:
- metaPct + tiktokPct must equal 100
- starter = $25/day (early stage, tight budget), growth = $75/day (scaling), scale = $200/day (established traction)
- Use distinct creative angles across the 3 ads
- imagePrompt should be a professional photographer/art director brief — describe the actual scene in detail`;

const REVISE_SYSTEM = `You are a world-class performance marketing strategist. 
You will receive an existing campaign JSON and a revision request.
Apply ONLY the requested change. Return the complete updated campaign JSON (same schema, no markdown).
Also append a boolean field "visualChanged": true/false indicating if any imagePrompt changed (so images need to be regenerated).`;

export async function generateCampaign(brief: string): Promise<CampaignData> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: GENERATE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Product description: ${brief}`,
      },
    ],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const jsonText = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
  const data = JSON.parse(jsonText) as CampaignData;

  // Validate required fields
  if (!data.brandName || !data.ads || data.ads.length !== 3) {
    throw new Error("Invalid campaign data from Claude");
  }

  return data;
}

export async function reviseCampaign(
  existing: CampaignData,
  request: string,
): Promise<{ campaign: CampaignData; visualChanged: boolean }> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: REVISE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Existing campaign:\n${JSON.stringify(existing, null, 2)}\n\nRevision request: ${request}`,
      },
    ],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const jsonText = text.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
  const result = JSON.parse(jsonText) as CampaignData & { visualChanged?: boolean };

  const visualChanged = result.visualChanged ?? false;
  const { visualChanged: _v, ...campaign } = result;

  return { campaign: campaign as CampaignData, visualChanged };
}
