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
  | "feed-portrait"
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

/** A best-in-class landing-page / website pattern that converts in 2026. */
export interface WebsiteReference {
  id: string;
  title: string;
  vertical: string;
  keywords: string[];
  heroDevice: string;
  sections: string[];
  typography: string;
  palette: string;
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
  "feed-portrait": {
    id: "feed-portrait",
    name: "Meta / Instagram / Google Display (4:5)",
    platforms: "Facebook Feed, Instagram Feed, Google Display",
    aspectRatio: "4:5",
    dimensions: "1080 x 1350",
    safeZone:
      "Product occupies 40–60% of frame, grounded. Designed empty negative space in the TOP ~32% for a 2–6 word billboard. Never place the product in that top band.",
    imageryNotes:
      "Photoreal product photography, contact shadow, real light. Hero or tight crop of the SAME campaign product. No neon void, no plastic sheen, no floating product.",
    copyNorms:
      "Hook is a 2–6 word billboard. Body 10–15 words, one concrete benefit. CTA 2–4 words, action-led.",
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

export const WEB_DESIGN_PRINCIPLES_2026: string[] = [
  "One conversion goal per page: every section earns the scroll toward a single primary CTA. Cut anything that doesn't move the visitor toward it.",
  "Above-the-fold clarity in 3 seconds: the visitor instantly knows what it is, who it's for, and the next step. Outcome-led headline, never a vague slogan.",
  "Show, don't tell: a real product visual, live demo, or before/after beats descriptive paragraphs and generic stock photography.",
  "Proof next to the ask: ratings, named testimonials, logos, or user counts sit exactly where doubt arises — not buried in a footer.",
  "Restrained designed system: 1–2 typefaces, one accent color, a confident type scale, generous whitespace, consistent rounded geometry. Editorial, not templated.",
  "Speed & mobile-first: sub-second feel, a thumb-reachable sticky CTA, and sections that reflow cleanly to a single column on phones.",
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

/**
 * Best-in-class 2026 landing-page archetypes by vertical. These drive the copy
 * the AI writes for the post-click page (hero, benefits, proof, CTA) and are
 * surfaced in the admin reference library as browser-frame mockups.
 */
export const WEBSITE_REFERENCES: WebsiteReference[] = [
  {
    id: "saas-product-tour",
    title: "Product-tour SaaS",
    vertical: "saas",
    keywords: ["saas", "software", "app", "tool", "platform", "dashboard", "workflow", "productivity", "b2b", "automation", "crm", "invoicing", "analytics"],
    heroDevice: "Live product UI floating on a soft gradient, one screen highlighted, outcome headline beside it.",
    sections: ["Outcome hero + product shot", "Trusted-by logo row", "Benefit-by-outcome rows (alternating)", "Interactive / animated demo", "Social proof wall", "Simple pricing", "FAQ", "Closing CTA"],
    typography: "Clean grotesque sans for UI confidence, large tracked headline, generous line-height.",
    palette: "Near-white canvas, ink text, a single saturated brand accent on CTAs and highlights.",
    whyItWorks: "Showing the actual product doing the job — not describing it — collapses the gap between curiosity and trust and lifts trial starts.",
  },
  {
    id: "dtc-product-story",
    title: "DTC product story",
    vertical: "ecommerce",
    keywords: ["dtc", "ecommerce", "shop", "store", "product", "brand", "consumer", "gadget", "accessory", "buy", "retail", "cpg"],
    heroDevice: "Full-bleed hero of the product in real use, bold benefit headline overlaid, add-to-cart in reach.",
    sections: ["Lifestyle hero + CTA", "Scrolling benefit ticker", "Ingredient / material breakdown", "UGC review wall with photos", "Us-vs-the-old-way comparison", "Guarantee & shipping", "Sticky buy bar"],
    typography: "Editorial serif display for desire, humanist sans for body, confident size jumps.",
    palette: "Warm neutral base, product-derived accent, lots of negative space around the hero.",
    whyItWorks: "A narrative from desire → proof → reassurance mirrors the buyer's doubts in order and removes them one by one before the ask.",
  },
  {
    id: "wellness-ritual",
    title: "Wellness ritual page",
    vertical: "wellness",
    keywords: ["wellness", "supplement", "health", "sleep", "calm", "vitamin", "gut", "energy", "self care", "mental health", "skincare", "beauty"],
    heroDevice: "Calm editorial hero — product held in soft morning light, serene one-line promise.",
    sections: ["Serene promise hero", "The felt-problem framing", "Science / ingredient proof", "The simple daily ritual (3 steps)", "Real customer testimonial", "Subscribe-and-save offer", "Risk-reversal guarantee"],
    typography: "Soft serif headlines, airy sans body, lowercase warmth, lots of breathing room.",
    palette: "Muted earthy tones — sand, clay, sage — one quiet accent. Nothing shouts.",
    whyItWorks: "Sensitive categories convert on calm credibility: emotional problem resonance plus believable proof earns trust where hype repels it.",
  },
  {
    id: "fintech-trust",
    title: "Trust-led fintech",
    vertical: "fintech",
    keywords: ["fintech", "finance", "money", "bank", "invest", "savings", "budget", "crypto", "payments", "card", "wealth", "trading"],
    heroDevice: "Bold numeric hero (a rate, a saving, a number) with a clean card motif and one decisive CTA.",
    sections: ["Numeric outcome hero", "Security & regulatory trust strip", "How it works in 3 steps", "Interactive calculator / preview", "Authority proof (press, audits)", "Transparent fees", "Final CTA with reassurance"],
    typography: "Precise grotesque, tabular numerals, high contrast, disciplined hierarchy.",
    palette: "Restrained mono base with one bold trust accent; deep ink for authority.",
    whyItWorks: "Concrete numbers plus visible security and regulatory cues overcome the category's default skepticism faster than any slogan.",
  },
  {
    id: "app-mobile-first",
    title: "Mobile-app showcase",
    vertical: "app",
    keywords: ["app", "mobile", "ios", "android", "consumer app", "habit", "tracker", "social", "game", "download", "fitness app"],
    heroDevice: "Floating phone mockup showing the core action mid-tap, app-store badges beside it.",
    sections: ["Phone-mockup hero + store badges", "The one magic moment (demo)", "App-store rating + reviews", "Feature carousel (swipeable)", "How it fits your day", "Download CTA"],
    typography: "Friendly geometric sans, big rounded headline, app-like spacing.",
    palette: "Bright but controlled — one vivid accent on a clean canvas, app-native feel.",
    whyItWorks: "Demonstrating the core loop on a real device removes uncertainty about what the app does and lifts install intent.",
  },
  {
    id: "course-outcome",
    title: "Outcome-promise course",
    vertical: "education",
    keywords: ["course", "education", "learn", "class", "bootcamp", "coaching", "skill", "certification", "cohort", "mentor", "training"],
    heroDevice: "Outcome hero (skill + timeframe) with the instructor on camera and a clear enroll CTA.",
    sections: ["Outcome + timeframe hero", "Who it's for / not for", "Curriculum breakdown", "Student results & testimonials", "Instructor credibility", "Pricing + guarantee", "Enroll CTA"],
    typography: "Confident serif headline for authority, clean sans for the syllabus, scannable lists.",
    palette: "Academic-warm neutrals with one motivating accent on CTAs and progress.",
    whyItWorks: "A specific, time-bound outcome plus visible student results makes the transformation feel achievable and de-risks the purchase.",
  },
  {
    id: "fashion-editorial",
    title: "Editorial fashion drop",
    vertical: "fashion",
    keywords: ["fashion", "clothing", "apparel", "wear", "style", "outfit", "streetwear", "denim", "accessories", "drop", "collection", "luxury"],
    heroDevice: "Oversized editorial campaign image, minimal type, a single 'Shop the drop' CTA.",
    sections: ["Full-bleed campaign hero", "Lookbook grid", "Craft / material story", "Drop scarcity & dates", "Styled-on-real-people gallery", "Shop CTA"],
    typography: "High-fashion serif or refined display caps, lots of negative space, restraint over volume.",
    palette: "Two-tone editorial palette, monochrome with one accent; imagery carries the color.",
    whyItWorks: "Restraint signals premium and sells a self-image rather than a discount, driving desire and full-price conversion.",
  },
  {
    id: "foodbev-appetite",
    title: "Appetite-appeal food & drink",
    vertical: "food-bev",
    keywords: ["food", "drink", "beverage", "coffee", "snack", "meal", "tea", "recipe", "kitchen", "grocery", "delivery", "restaurant"],
    heroDevice: "Hyper-fresh hero (pour, steam, bite) with a craving-led headline and order CTA.",
    sections: ["Appetite hero + CTA", "Sourcing / how it's made", "Flavor or menu grid", "Sustainability & provenance", "Reviews / ratings", "Find-in-store or order CTA"],
    typography: "Characterful display for flavor personality, clean sans for the menu, warm and tactile.",
    palette: "Rich appetite tones pulled from the product, warm light, shallow-depth imagery.",
    whyItWorks: "Appetite cues stop the scroll instantly and a provenance story justifies premium price and builds repeat trust.",
  },
];

/** The three ads always map to these placements (kept in sync with imagePipeline). */
export const AD_SLOT_CONTRACTS: AdSlotContract[] = [
  {
    idx: 0,
    label: "Ad 1 — hero (4:5)",
    placement: "feed-portrait",
    direction:
      "Hero pack-shot of THIS product. Same light family as ads 2 and 3. Product 40–60% of frame, contact shadow, empty top third for type.",
  },
  {
    idx: 1,
    label: "Ad 2 — context (9:16)",
    placement: "vertical",
    direction:
      "Context shot of the SAME product in a real environment. Same light family and color temperature as Ad 1. Product 40–60% of frame. Empty top band for type. Keep lower-right clear of the product (platform chrome).",
  },
  {
    idx: 2,
    label: "Ad 3 — tight crop (4:5)",
    placement: "feed-portrait",
    direction:
      "Tight crop of the SAME product, closer, more tactile. Same campaign light as Ad 1. Not a different board.",
  },
];

export const REFERENCE_ARCHETYPES: ReferenceArchetype[] = [
  {
    id: "saas-clarity",
    title: "Clarity-first SaaS demo",
    vertical: "saas",
    keywords: ["saas", "software", "app", "tool", "platform", "dashboard", "workflow", "productivity", "b2b", "automation", "ai tool", "invoicing", "crm"],
    surface: "feed-portrait",
    angle: "Problem/Solution",
    imageryStyle: "Clean product UI on a soft, oversized device mock in a calm scene; one highlighted screen, lots of breathing room, single accent color.",
    hookPattern: "Name the painful manual task in 2–6 words.",
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
    surface: "feed-portrait",
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
    surface: "feed-portrait",
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
    surface: "feed-portrait",
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
    surface: "feed-portrait",
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
    surface: "feed-portrait",
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
    surface: "feed-portrait",
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
    surface: "feed-portrait",
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
    surface: "feed-portrait",
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

/**
 * Pick the most relevant landing-page archetype(s) for the brief, mirroring the
 * ad selector's keyword + vertical scoring. Always returns at least one.
 */
export function selectWebsiteReferences(
  brief: string,
  category?: string,
  k = 1,
): WebsiteReference[] {
  const tokens = new Set([...tokenize(brief), ...tokenize(category ?? "")]);

  const scored = WEBSITE_REFERENCES.map((ref) => {
    let score = 0;
    for (const kw of ref.keywords) {
      const parts = kw.split(/\s+/);
      const hit = parts.every((p) => tokens.has(p)) || tokens.has(kw);
      if (hit) score += 2;
    }
    if (category && ref.vertical === category.toLowerCase()) score += 3;
    return { ref, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const picked = scored.filter((s, i) => s.score > 0 || i === 0).map((s) => s.ref);
  if (picked.length < k) {
    for (const ref of WEBSITE_REFERENCES) {
      if (picked.length >= k) break;
      if (!picked.includes(ref)) picked.push(ref);
    }
  }
  return picked.slice(0, k);
}

/** Full, structured snapshot of the reference library (for the admin view). */
export function getReferenceLibrary() {
  return {
    designPrinciples: DESIGN_PRINCIPLES_2026,
    webPrinciples: WEB_DESIGN_PRINCIPLES_2026,
    placements: Object.values(PLACEMENT_SPECS),
    slotContracts: AD_SLOT_CONTRACTS,
    adArchetypes: REFERENCE_ARCHETYPES,
    websiteReferences: WEBSITE_REFERENCES,
    landingPattern: LANDING_PATTERN,
  };
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
    PLACEMENT_SPECS["feed-portrait"],
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

  const webPrinciples = WEB_DESIGN_PRINCIPLES_2026.slice(0, 4)
    .map((p) => `- ${p}`)
    .join("\n");

  const site = selectWebsiteReferences(brief, category, 1)[0];
  const siteRef = site
    ? `

RELEVANT LANDING-PAGE REFERENCE (adapt the structure & emphasis for THIS product — never copy):
- ${site.title} (${site.vertical}) — Hero: ${site.heroDevice} Sections: ${site.sections.join(" → ")}. Typography: ${site.typography} Palette: ${site.palette} Why it works: ${site.whyItWorks}`
    : "";

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
${landing}

WEB DESIGN PRINCIPLES (apply to the landing copy & structure):
${webPrinciples}${siteRef}`;
}
