/**
 * Reference library — curated, in-house knowledge of best-in-class 2026
 * design-forward paid-social advertising and landing-page patterns.
 *
 * These are distilled performance ARCHETYPES and platform specs, NOT copies of
 * any real brand's ads. Generation consumes this through `buildReferencePlaybook`
 * so the AI derives principles and respects each placement's specs (aspect ratio,
 * dimensions, safe zones, imagery + copy norms) — without reproducing anyone's
 * names, layouts, claims, or copy verbatim.
 */

export type AdSurface =
  | "feed-square"
  | "vertical"
  | "tiktok-infeed"
  | "landing";

/** Authoritative spec for a paid-social placement / surface. */
export interface PlacementSpec {
  id: AdSurface;
  name: string;
  platforms: string;
  aspectRatio: string;
  dimensions: string;
  safeZone: string;
  imageryNotes: string;
  copyNorms: string;
}

/** A reusable creative pattern that performs well in 2026 paid social. */
export interface ReferenceArchetype {
  id: string;
  title: string;
  vertical: string;
  keywords: string[];
  surface: AdSurface;
  angle: string;
  imageryStyle: string;
  hookPattern: string;
  bodyPattern: string;
  ctaPattern: string;
  whyItWorks: string;
}

/** Which placement each of the three generated ads targets. */
export interface AdSlotContract {
  idx: number;
  label: string;
  placement: AdSurface;
  direction: string;
}

export const PLACEMENT_SPECS: Record<AdSurface, PlacementSpec> = {
  "feed-square": {
    id: "feed-square",
    name: "Meta / Instagram Feed",
    platforms: "Facebook Feed, Instagram Feed",
    aspectRatio: "1:1",
    dimensions: "1080 x 1080",
    safeZone:
      "Keep the focal subject within the central 90%; the bottom strip is partly covered by the headline + CTA overlay.",
    imageryNotes:
      "One dominant, thumb-stopping subject with high focal contrast and generous negative space. Lifestyle-in-context beats packshots. Reads instantly at small size and sound-off.",
    copyNorms:
      "Hook 5–8 words, front-loaded. Body 10–15 words, one concrete benefit. CTA 2–4 words, action-led.",
  },
  vertical: {
    id: "vertical",
    name: "Reels / Stories (vertical)",
    platforms: "Instagram Reels & Stories, Facebook Reels",
    aspectRatio: "9:16",
    dimensions: "1080 x 1920",
    safeZone:
      "Center the subject; leave the top ~14% and bottom ~22% clear of key elements so platform UI, captions and the CTA do not cover them.",
    imageryNotes:
      "Full-bleed, immersive, native/creator energy over studio gloss. Authentic lighting, single subject, motion-friendly composition. Designed vertical-first.",
    copyNorms:
      "Ultra-short, punchy. Hook 4–7 words readable in the first second. Body one tight line. CTA 2–3 words.",
  },
  "tiktok-infeed": {
    id: "tiktok-infeed",
    name: "TikTok In-Feed",
    platforms: "TikTok For You feed",
    aspectRatio: "9:16",
    dimensions: "1080 x 1920",
    safeZone:
      "Keep text and product within the central column; right ~12% and bottom ~25% hold TikTok's action rail and caption.",
    imageryNotes:
      "Looks like organic content, not an ad: creator-led, hand-held feel, sound-on intent, immediate payoff. Avoid corporate polish.",
    copyNorms:
      "Native, conversational, hook in first 1–2s. Body reads like a person talking. CTA casual ('try it', 'grab yours').",
  },
  landing: {
    id: "landing",
    name: "Landing page",
    platforms: "Post-click web",
    aspectRatio: "responsive",
    dimensions: "fluid, mobile-first",
    safeZone: "Primary CTA above the fold; sticky CTA on scroll.",
    imageryNotes:
      "Hero shows the product in real use. Whitespace-led, one accent color, fast. Visual proof (demo / before-after) over stock imagery.",
    copyNorms:
      "Outcome-led hero headline; sub names who it's for; benefits framed as outcomes, not feature lists.",
  },
};

export const DESIGN_PRINCIPLES_2026: string[] = [
  "Thumb-stopping first frame: one dominant subject, bold focal contrast, generous negative space. Assume sound-off and a 2-second glance.",
  "Native over polished: 2026's top performers feel platform-native (creator/UGC energy, real lighting) rather than over-produced — even for premium brands.",
  "One idea per ad: a single sharp message and a single CTA. Clarity beats cleverness.",
  "Benefit-led, specific copy: concrete outcomes and numbers ('fall asleep 40% faster'), never vague adjectives. Lead with the customer's problem or desire.",
  "Designed typography & restrained palette: 1–2 typefaces, strong hierarchy, high contrast, at most two accent colors, modern editorial spacing.",
  "Motion-aware, vertical-first composition: center the subject and respect platform safe zones so UI chrome never covers the message.",
  "Proof early, friction late: place social proof / ratings / a credibility cue up front; make the CTA obvious and low-commitment.",
];

/** High-converting 2026 landing-page structure (outcome-led, proof-rich). */
export const LANDING_PATTERN = {
  structure: [
    "Hero: outcome-driven headline (5–8 words) + one-line sub naming who it's for + primary CTA above the fold + a visual of the product in use.",
    "Proof bar directly under the hero: ratings, user count, or recognizable trust cues.",
    "Three benefit blocks framed as outcomes (not feature lists) — each = the result + one supporting line.",
    "Visual demonstration: product-in-action or a before/after that makes the value obvious.",
    "Objection handling: a short guarantee, FAQ, or risk-reversal line.",
    "Closing CTA that restates the core outcome and removes risk.",
  ],
  principles:
    "Whitespace-led, single accent color, sticky CTA, sub-second feel. Every section earns the scroll toward one conversion goal.",
};

/** The three ads always map to these placements (kept in sync with imagePipeline). */
export const AD_SLOT_CONTRACTS: AdSlotContract[] = [
  {
    idx: 0,
    label: "Ad 1 — Meta / Instagram Feed",
    placement: "feed-square",
    direction:
      "The flagship feed ad. Strongest single benefit, most polished hero image.",
  },
  {
    idx: 1,
    label: "Ad 2 — Reels / Stories / TikTok (vertical)",
    placement: "vertical",
    direction:
      "Native vertical creative. Punchier, more authentic energy; respect vertical safe zones. Since this also runs on TikTok, keep key elements out of the right ~12% (action rail) and bottom ~25% (caption).",
  },
  {
    idx: 2,
    label: "Ad 3 — Meta / Instagram Feed (alternate angle)",
    placement: "feed-square",
    direction:
      "A clearly DIFFERENT angle and visual treatment from Ad 1 (e.g. social proof, FOMO, or transformation).",
  },
];

export const REFERENCE_ARCHETYPES: ReferenceArchetype[] = [
  {
    id: "saas-clarity",
    title: "Clarity-first SaaS demo",
    vertical: "saas",
    keywords: ["saas", "software", "app", "tool", "platform", "dashboard", "workflow", "productivity", "b2b", "automation", "ai tool", "invoicing", "crm"],
    surface: "feed-square",
    angle: "Problem/Solution",
    imageryStyle: "Clean product UI on a soft, oversized device mock in a calm scene; one highlighted screen, lots of breathing room, single accent color.",
    hookPattern: "Name the painful manual task in 5–7 words.",
    bodyPattern: "State the time/effort saved as a concrete outcome.",
    ctaPattern: "'Try it free' / 'Start free'.",
    whyItWorks: "Shows the product doing the job and quantifies relief; reduces perceived effort to adopt.",
  },
  {
    id: "saas-before-after",
    title: "Before/after workflow split",
    vertical: "saas",
    keywords: ["saas", "software", "workflow", "spreadsheet", "manual", "team", "ops", "tool", "platform"],
    surface: "vertical",
    angle: "Transformation",
    imageryStyle: "Split or sequential vertical frames — chaotic 'before' vs calm 'after' — native screen-record feel.",
    hookPattern: "'Still doing X by hand?'",
    bodyPattern: "Contrast the messy old way with the one-tap new way.",
    ctaPattern: "'See how'.",
    whyItWorks: "The visible contrast makes the value self-evident in under two seconds.",
  },
  {
    id: "wellness-pas",
    title: "Problem-Agitate-Relief (wellness)",
    vertical: "wellness",
    keywords: ["wellness", "supplement", "sleep", "health", "vitamin", "calm", "stress", "anxiety", "gut", "energy", "mental health", "self care"],
    surface: "feed-square",
    angle: "Problem/Solution",
    imageryStyle: "Warm, soft natural light; product held in-hand in a serene morning/evening moment; muted earthy palette.",
    hookPattern: "Voice the felt problem ('Tired of 3am wake-ups?').",
    bodyPattern: "Promise a specific, believable improvement.",
    ctaPattern: "'Feel the difference'.",
    whyItWorks: "Emotional problem resonance plus a calm, trustworthy aesthetic earns sensitive-category trust.",
  },
  {
    id: "fitness-transformation",
    title: "Real-results transformation",
    vertical: "fitness",
    keywords: ["fitness", "workout", "gym", "training", "weight", "muscle", "run", "coach", "exercise", "wellbeing", "busy parents"],
    surface: "vertical",
    angle: "Social Proof",
    imageryStyle: "Authentic UGC-style clip of a real-looking person mid-routine; raw lighting, on-screen captions.",
    hookPattern: "'I tried X for 30 days.'",
    bodyPattern: "Specific outcome with a number and timeframe.",
    ctaPattern: "'Start day 1'.",
    whyItWorks: "Relatable creator proof beats aspirational models for credibility and saves.",
  },
  {
    id: "fashion-editorial",
    title: "Editorial drop",
    vertical: "fashion",
    keywords: ["fashion", "clothing", "apparel", "wear", "style", "outfit", "streetwear", "sustainable clothing", "accessories", "denim", "brand"],
    surface: "feed-square",
    angle: "Aspirational Identity",
    imageryStyle: "Magazine-grade editorial styling, confident model or flat-lay, strong negative space, refined two-tone palette.",
    hookPattern: "A short identity statement, not a discount.",
    bodyPattern: "One line on craft, material, or fit.",
    ctaPattern: "'Shop the drop'.",
    whyItWorks: "Sells a self-image; restraint signals premium and drives desire over price.",
  },
  {
    id: "beauty-texture",
    title: "Texture & ritual close-up",
    vertical: "beauty",
    keywords: ["beauty", "skincare", "cosmetics", "serum", "makeup", "glow", "cream", "hair", "spa", "routine"],
    surface: "vertical",
    angle: "Sensory Desire",
    imageryStyle: "Macro close-up of texture/application; dewy light, satisfying motion, skin-true tones.",
    hookPattern: "Tease the sensory payoff ('That first-glow feeling').",
    bodyPattern: "Name the hero ingredient and its result.",
    ctaPattern: "'Get the glow'.",
    whyItWorks: "Tactile macro imagery triggers desire and dwell time; ingredient specificity builds trust.",
  },
  {
    id: "foodbev-appetite",
    title: "Appetite-appeal hero",
    vertical: "food-bev",
    keywords: ["food", "drink", "beverage", "coffee", "snack", "meal", "cold brew", "tea", "recipe", "kitchen", "cpg", "grocery", "delivery"],
    surface: "feed-square",
    angle: "Sensory Desire",
    imageryStyle: "Hyper-fresh hero shot — condensation, steam, pour or bite moment; rich color, shallow depth of field.",
    hookPattern: "Evoke the craving in 4–6 words.",
    bodyPattern: "One line on taste + how it's made/sourced.",
    ctaPattern: "'Taste it'.",
    whyItWorks: "Appetite cues are instantly stopping; provenance line adds premium justification.",
  },
  {
    id: "app-onboard",
    title: "One-thumb app value",
    vertical: "app",
    keywords: ["app", "mobile", "ios", "android", "consumer app", "habit", "tracker", "social app", "game", "fintech app"],
    surface: "vertical",
    angle: "Problem/Solution",
    imageryStyle: "Phone-in-hand POV showing the core action in one tap; native screen-record, captioned.",
    hookPattern: "State the job-to-be-done ('Track it in 5 seconds').",
    bodyPattern: "Show the single magic moment.",
    ctaPattern: "'Get the app'.",
    whyItWorks: "Demonstrating the core loop on a real phone lifts install intent and reduces uncertainty.",
  },
  {
    id: "fintech-trust",
    title: "Trust-led fintech",
    vertical: "fintech",
    keywords: ["fintech", "finance", "money", "bank", "invest", "savings", "budget", "crypto", "payments", "card", "wealth"],
    surface: "feed-square",
    angle: "Authority/Trust",
    imageryStyle: "Confident, minimal, high-contrast; clean card/number motif; restrained palette with one bold accent.",
    hookPattern: "Lead with a concrete financial outcome or number.",
    bodyPattern: "Pair the benefit with a credibility/security cue.",
    ctaPattern: "'Open in minutes'.",
    whyItWorks: "Specific numbers plus visible trust signals overcome the category's skepticism.",
  },
  {
    id: "home-context",
    title: "In-context home transformation",
    vertical: "home",
    keywords: ["home", "furniture", "decor", "kitchen", "cleaning", "appliance", "diy", "interior", "garden", "mattress", "bedding"],
    surface: "feed-square",
    angle: "Transformation",
    imageryStyle: "Product styled in a real, beautiful room; warm light, aspirational-but-attainable staging.",
    hookPattern: "Promise the upgraded everyday moment.",
    bodyPattern: "One line on the practical benefit + the feeling.",
    ctaPattern: "'Upgrade yours'.",
    whyItWorks: "Seeing it at home closes the imagination gap and drives consideration.",
  },
  {
    id: "education-outcome",
    title: "Outcome-promise course",
    vertical: "education",
    keywords: ["course", "education", "learn", "class", "bootcamp", "coaching", "skill", "tutorial", "certification", "study", "language"],
    surface: "vertical",
    angle: "Aspirational Identity",
    imageryStyle: "Creator talking to camera or screen-share of real progress; energetic, captioned, authentic.",
    hookPattern: "Name the skill + the timeframe ('Land X in 6 weeks').",
    bodyPattern: "What you'll be able to do, concretely.",
    ctaPattern: "'Enroll now'.",
    whyItWorks: "A specific, time-bound outcome makes the transformation feel achievable.",
  },
  {
    id: "sustainability-proof",
    title: "Proof-driven sustainability",
    vertical: "sustainability",
    keywords: ["sustainable", "eco", "green", "recycled", "carbon", "ethical", "reusable", "plant", "climate", "organic", "zero waste"],
    surface: "feed-square",
    angle: "Values/Proof",
    imageryStyle: "Tactile, natural materials in honest daylight; show the real thing, not greenwash graphics.",
    hookPattern: "State the concrete impact, not a vague claim.",
    bodyPattern: "Back the value with a verifiable detail.",
    ctaPattern: "'Make the switch'.",
    whyItWorks: "Specific, provable claims beat vague eco language and avoid skepticism.",
  },
  {
    id: "fomo-launch",
    title: "Scarcity / launch FOMO",
    vertical: "general",
    keywords: ["launch", "drop", "limited", "new", "preorder", "waitlist", "exclusive", "early access", "founder"],
    surface: "feed-square",
    angle: "FOMO",
    imageryStyle: "Bold, high-energy hero with a clear 'new/limited' visual cue; confident single accent color.",
    hookPattern: "Signal newness or scarcity in 4–6 words.",
    bodyPattern: "What they miss if they wait.",
    ctaPattern: "'Get early access'.",
    whyItWorks: "Time pressure plus novelty drives immediate action on launches.",
  },
  {
    id: "social-proof-ugc",
    title: "Stacked social proof",
    vertical: "general",
    keywords: ["reviews", "rated", "testimonial", "popular", "bestseller", "trusted", "loved", "community", "5 star"],
    surface: "vertical",
    angle: "Social Proof",
    imageryStyle: "Real customer moment or review-card motif over an authentic scene; captioned quote feel.",
    hookPattern: "Lead with the number of happy customers or a star rating.",
    bodyPattern: "A short, believable quote-style benefit.",
    ctaPattern: "'See why'.",
    whyItWorks: "Volume + specificity of proof lowers risk and boosts conversion.",
  },
  {
    id: "founder-story",
    title: "Founder POV story",
    vertical: "general",
    keywords: ["founder", "story", "handmade", "small business", "mission", "why we", "indie", "startup"],
    surface: "tiktok-infeed",
    angle: "Authenticity",
    imageryStyle: "Founder talking to camera, hand-held, honest and warm; no studio polish.",
    hookPattern: "Open mid-story ('We built this because…').",
    bodyPattern: "The problem they lived and what they made.",
    ctaPattern: "'Support the mission' / 'Try it'.",
    whyItWorks: "Human authenticity earns trust and travels well on TikTok's organic-feeling feed.",
  },
  {
    id: "value-comparison",
    title: "Us-vs-old-way comparison",
    vertical: "general",
    keywords: ["alternative", "switch", "vs", "replace", "better than", "save", "ditch", "upgrade from"],
    surface: "feed-square",
    angle: "Problem/Solution",
    imageryStyle: "Clean visual contrast of the old painful way vs the new product; one accent color carries the eye.",
    hookPattern: "Frame the tired status quo.",
    bodyPattern: "The single biggest way you're better.",
    ctaPattern: "'Make the switch'.",
    whyItWorks: "A clear contrast gives the viewer an instant reason to prefer you.",
  },
];

const STOPWORDS = new Set([
  "the", "a", "an", "for", "and", "or", "to", "of", "in", "on", "with", "your",
  "our", "that", "this", "it", "is", "are", "be", "by", "as", "at", "from",
  "who", "want", "their", "they", "you", "we", "app", "brand", "product",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Index/selector: score archetypes against the brief (and optional category)
 * by keyword + vertical overlap, then return a diverse top-K (capped per
 * vertical) so the playbook spans angles and formats rather than one niche.
 */
export function selectReferences(
  brief: string,
  category?: string,
  k = 5,
): ReferenceArchetype[] {
  const tokens = new Set([...tokenize(brief), ...tokenize(category ?? "")]);

  const scored = REFERENCE_ARCHETYPES.map((ref) => {
    let score = 0;
    for (const kw of ref.keywords) {
      const parts = kw.split(/\s+/);
      const hit = parts.every((p) => tokens.has(p)) || tokens.has(kw);
      if (hit) score += 2;
    }
    if (category && ref.vertical === category.toLowerCase()) score += 3;
    if (ref.vertical === "general") score += 0.5;
    return { ref, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked: ReferenceArchetype[] = [];
  const perVertical = new Map<string, number>();

  for (const { ref, score } of scored) {
    if (picked.length >= k) break;
    if (score <= 0 && picked.length > 0) continue;
    const count = perVertical.get(ref.vertical) ?? 0;
    if (ref.vertical !== "general" && count >= 2) continue;
    picked.push(ref);
    perVertical.set(ref.vertical, count + 1);
  }

  // Backfill (e.g. a brief that matched nothing) with versatile general angles.
  if (picked.length < k) {
    for (const ref of REFERENCE_ARCHETYPES) {
      if (picked.length >= k) break;
      if (!picked.includes(ref)) picked.push(ref);
    }
  }

  return picked.slice(0, k);
}

function placementLine(p: PlacementSpec): string {
  return `${p.name} — ${p.aspectRatio} (${p.dimensions}). Imagery: ${p.imageryNotes} Copy: ${p.copyNorms} Safe zone: ${p.safeZone}`;
}

/**
 * Assemble the compact prompt block injected into generation. Kept under ~3k
 * tokens: 7 principles, 3 placement specs + slot contracts, the selected
 * archetypes, and the landing pattern.
 */
export function buildReferencePlaybook(brief: string, category?: string): string {
  const refs = selectReferences(brief, category);

  const principles = DESIGN_PRINCIPLES_2026.map((p) => `- ${p}`).join("\n");

  const placements = [
    PLACEMENT_SPECS["feed-square"],
    PLACEMENT_SPECS["vertical"],
    PLACEMENT_SPECS["tiktok-infeed"],
  ]
    .map((p) => `- ${placementLine(p)}`)
    .join("\n");

  const slots = AD_SLOT_CONTRACTS.map((s) => {
    const p = PLACEMENT_SPECS[s.placement];
    return `- ${s.label} [${p.aspectRatio}, ${p.dimensions}]: ${s.direction} Safe zone: ${p.safeZone}`;
  }).join("\n");

  const archetypes = refs
    .map(
      (r) =>
        `- ${r.title} (${r.vertical}, best on ${PLACEMENT_SPECS[r.surface].name}) — angle: ${r.angle}. Imagery: ${r.imageryStyle} Hook: ${r.hookPattern} Body: ${r.bodyPattern} CTA: ${r.ctaPattern} Why it works: ${r.whyItWorks}`,
    )
    .join("\n");

  const landing = [
    ...LANDING_PATTERN.structure.map((s) => `- ${s}`),
    `- Overall: ${LANDING_PATTERN.principles}`,
  ].join("\n");

  return `REFERENCE PLAYBOOK (internal — curated 2026 performance archetypes & platform specs).
Use this to DERIVE principles for THIS product. Never reuse any real brand's name, layout, claims, or copy verbatim; treat the archetypes as patterns, not text to copy.

2026 DESIGN-FORWARD PRINCIPLES:
${principles}

PLACEMENT SPECS (aspect ratio, dimensions, imagery + copy norms, safe zones):
${placements}

AD SLOT CONTRACTS — write each ad's copy and imagePrompt to fit its placement:
${slots}

RELEVANT CREATIVE ARCHETYPES (patterns to adapt, not copy):
${archetypes}

HIGH-CONVERTING LANDING-PAGE PATTERN:
${landing}`;
}
