import type { CampaignAd, CampaignData } from "./claude.js";
import { AD_SLOTS, billboardLine, wordCount } from "./craft.js";

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "our",
  "we",
  "you",
  "is",
  "are",
  "to",
  "of",
  "in",
  "on",
  "at",
  "it",
  "as",
  "by",
  "its",
  "into",
]);

function firstSentence(brief: string): string {
  const t = brief.trim().replace(/\s+/g, " ");
  const m = t.match(/^[^.!?]+[.!?]?/);
  return (m?.[0] ?? t).trim();
}

function words(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9']+$/g, ""))
    .filter(Boolean);
}

function contentWords(text: string): string[] {
  return words(text).filter((w) => !STOP.has(w.toLowerCase()));
}

function titleCase(list: string[]): string {
  return list
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function clipWords(text: string, n: number): string {
  const list = words(text);
  if (list.length <= n) return text.trim();
  return `${list.slice(0, n).join(" ")}.`;
}

function hookLine(parts: string[], fallback: string): string {
  const line = billboardLine(parts.filter(Boolean).join(" ") || fallback);
  if (wordCount(line) >= 2) return line;
  return billboardLine(`${line} ready`);
}

export function brandNameFromBrief(brief: string): string {
  const content = contentWords(firstSentence(brief));
  if (content.length === 0) return "The Product";
  return titleCase(content.slice(0, 3));
}

/**
 * Briefing-presentable campaign when Grok cannot land ads in the generate
 * window. Derived from the founder brief — not lorem, not a 504.
 */
export function failClosedCampaignFromBrief(brief: string): CampaignData {
  const product = firstSentence(brief) || "the product in the brief";
  const content = contentWords(product);
  const brandName = brandNameFromBrief(brief);
  const palette = ["#1A1A1A", "#C4A574", "#F4EDE4", "#111111"];
  const noun = content[0] ?? "product";
  const subject = clipWords(product, 22);
  const photoNote = "Pure photography. Empty top band. Product 40 to 60 percent of frame.";

  const ads: CampaignAd[] = [
    {
      hook: hookLine(content.slice(0, 4), "The real thing"),
      body: clipWords(product, 14),
      cta: "Get yours",
      angle: "Hero",
      imagePrompt: `${AD_SLOTS[0]!.label}. Hero pack-shot of the same product. Subject: ${subject} ${photoNote}`,
      gradientHex1: palette[0]!,
      gradientHex2: palette[1]!,
    },
    {
      hook: hookLine(
        content.slice(1, 5).length >= 2 ? content.slice(1, 5) : ["In", "the", "room"],
        "In the room",
      ),
      body: clipWords(`${product} In use, in a real place.`, 15),
      cta: "See it work",
      angle: "Context",
      imagePrompt: `${AD_SLOTS[1]!.label}. Context shot of the same product in a real room. Subject: ${subject} ${photoNote}`,
      gradientHex1: palette[0]!,
      gradientHex2: palette[1]!,
    },
    {
      hook: hookLine(["Closer", noun], "Closer look"),
      body: clipWords(`A closer look at ${product}`, 14),
      cta: "Order now",
      angle: "Tight crop",
      imagePrompt: `${AD_SLOTS[2]!.label}. Tight crop of the same product, closer, tactile. Subject: ${subject} ${photoNote}`,
      gradientHex1: palette[0]!,
      gradientHex2: palette[1]!,
    },
  ];

  return {
    brandName,
    tagline: clipWords(product, 10) || `${brandName} from the brief`,
    category: (content[content.length - 1] ?? "product").toLowerCase(),
    palette,
    audience: {
      ageMin: 25,
      ageMax: 54,
      interests: content.slice(0, 4).map((w) => w.toLowerCase()),
      geo: "US",
    },
    channelSplit: {
      metaPct: 40,
      tiktokPct: 35,
      googlePct: 25,
      rationale: "Meta and TikTok for the boards; Google for intent.",
    },
    recommendedBudgetPreset: "growth",
    ads,
    landing: {
      hero: clipWords(product, 8) || brandName,
      sub: product,
      features: [
        clipWords(product, 6),
        "Made for the brief you wrote",
        "Three boards, one campaign",
      ],
      socialProof: `Written from the founder brief for ${brandName}.`,
      cta: "Get yours",
      faqs: [
        { q: `What is ${brandName}?`, a: product },
        { q: "Who is it for?", a: "People who asked for this product in the brief." },
        { q: "How do I start?", a: "Review the three boards, then launch when the stills land." },
      ],
    },
  };
}
