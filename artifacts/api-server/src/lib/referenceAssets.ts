import { anthropic } from "@workspace/integrations-anthropic-ai";
import {
  db,
  referenceAssetsTable,
  type ReferenceAnalysis,
  type ReferenceAsset,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { uploadBuffer, getAsset } from "./storage.js";
import { generateId } from "./ids.js";
import { logger } from "./logger.js";
import { REFERENCE_SEEDS } from "./referenceSeed.js";

export interface PlatformMeta {
  slug: string;
  label: string;
}

// The platforms the reference library is organised by. Order = display order.
export const REFERENCE_PLATFORMS: PlatformMeta[] = [
  { slug: "tiktok", label: "TikTok" },
  { slug: "instagram-stories", label: "Instagram Stories" },
  { slug: "instagram-feed", label: "Instagram Feed" },
  { slug: "facebook", label: "Facebook" },
  { slug: "google-ads", label: "Google Ads" },
  { slug: "linkedin", label: "LinkedIn" },
];

const PLATFORM_SLUGS = new Set(REFERENCE_PLATFORMS.map((p) => p.slug));

export function isValidPlatform(slug: unknown): slug is string {
  return typeof slug === "string" && PLATFORM_SLUGS.has(slug);
}

export function platformLabel(slug: string): string {
  return REFERENCE_PLATFORMS.find((p) => p.slug === slug)?.label ?? slug;
}

/** Normalise any incoming image to a sane JPEG so storage + vision are consistent. */
async function toJpeg(input: Buffer): Promise<Buffer> {
  try {
    const { default: sharp } = await import("sharp");
    return await sharp(input)
      .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    // sharp unavailable — fall back to raw bytes (best effort)
    return input;
  }
}

const ANALYZE_SYSTEM = `You are a senior creative director auditing a paid-social ad creative.
Look at the image and return STRICT JSON (no markdown, no prose) with this exact shape:
{
  "format": "string — visual format, e.g. 'product hero on solid color', 'lifestyle UGC', 'bold-type statement', 'before/after', 'app screenshot mockup'",
  "hook": "string — the dominant attention device in 8-14 words (visual or headline)",
  "angle": "string — the strategic angle, e.g. 'Social Proof', 'FOMO', 'Problem/Solution', 'Aspirational', 'Bold Claim'",
  "visualTokens": ["3-6 short tags describing the visual language, e.g. 'high-contrast', 'sans-serif headline', 'human face', 'duotone', 'negative space'"],
  "copyPattern": "string — how the on-image copy is structured, 10-18 words",
  "tone": "string — 2-4 words, e.g. 'playful, irreverent' or 'premium, minimal'",
  "whyItWorks": "string — one sentence on the persuasion mechanic that makes it effective"
}
Describe only what you can see. Do not invent brand claims.`;

function parseAnalysis(text: string): ReferenceAnalysis {
  const json = text
    .replace(/^```json?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
  const raw = JSON.parse(json) as Partial<ReferenceAnalysis>;
  return {
    format: String(raw.format ?? "").slice(0, 200),
    hook: String(raw.hook ?? "").slice(0, 240),
    angle: String(raw.angle ?? "").slice(0, 120),
    visualTokens: Array.isArray(raw.visualTokens)
      ? raw.visualTokens.map((t) => String(t).slice(0, 40)).slice(0, 8)
      : [],
    copyPattern: String(raw.copyPattern ?? "").slice(0, 300),
    tone: String(raw.tone ?? "").slice(0, 80),
    whyItWorks: String(raw.whyItWorks ?? "").slice(0, 320),
  };
}

/** Vision-analyse an image (RAG indexing). Throws on failure. */
export async function analyzeReferenceImage(
  jpeg: Buffer,
  context: { platform: string; title?: string | null },
): Promise<ReferenceAnalysis> {
  const base64 = jpeg.toString("base64");
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: ANALYZE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/jpeg", data: base64 },
          },
          {
            type: "text",
            text: `This ad ran on ${platformLabel(context.platform)}.${
              context.title ? ` Context: ${context.title}.` : ""
            } Audit it and return the JSON.`,
          },
        ],
      },
    ],
  });
  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  return parseAnalysis(text);
}

async function runAnalysis(id: string, jpeg: Buffer, platform: string, title?: string | null) {
  try {
    const analysis = await analyzeReferenceImage(jpeg, { platform, title });
    await db
      .update(referenceAssetsTable)
      .set({ analysis, status: "ready" })
      .where(eq(referenceAssetsTable.id, id));
    logger.info({ id, platform }, "Reference asset indexed into corpus");
  } catch (err) {
    logger.error({ err, id }, "Reference asset analysis failed");
    await db
      .update(referenceAssetsTable)
      .set({ status: "failed" })
      .where(eq(referenceAssetsTable.id, id));
  }
}

interface IngestInput {
  platform: string;
  source: "curated" | "uploaded";
  buffer: Buffer;
  title?: string | null;
  sourceUrl?: string | null;
  seedKey?: string | null;
  id?: string;
}

/**
 * Store an image and index it into the reference corpus. By default analysis
 * runs in the background (fast response for uploads); pass analyzeInline to
 * await it (used at seed time so the corpus is fully ready).
 */
export async function ingestReferenceImage(
  input: IngestInput,
  opts: { analyzeInline?: boolean } = {},
): Promise<ReferenceAsset> {
  const id = input.id ?? generateId("ref");
  const jpeg = await toJpeg(input.buffer);
  const key = `reference-assets/${input.platform}/${id}.jpg`;
  const imageUrl = await uploadBuffer(key, jpeg, "image/jpeg");

  const [row] = await db
    .insert(referenceAssetsTable)
    .values({
      id,
      platform: input.platform,
      source: input.source,
      sourceUrl: input.sourceUrl ?? null,
      title: input.title ?? null,
      imageKey: key,
      imageUrl,
      seedKey: input.seedKey ?? null,
      status: "analyzing",
    })
    .returning();

  if (opts.analyzeInline) {
    await runAnalysis(id, jpeg, input.platform, input.title);
    const [refreshed] = await db
      .select()
      .from(referenceAssetsTable)
      .where(eq(referenceAssetsTable.id, id));
    return refreshed ?? row!;
  }

  // Fire-and-forget background analysis.
  void runAnalysis(id, jpeg, input.platform, input.title);
  return row!;
}

export async function listReferenceAssets(): Promise<ReferenceAsset[]> {
  return db
    .select()
    .from(referenceAssetsTable)
    .orderBy(desc(referenceAssetsTable.createdAt));
}

export async function deleteReferenceAsset(id: string): Promise<boolean> {
  const [deleted] = await db
    .delete(referenceAssetsTable)
    .where(eq(referenceAssetsTable.id, id))
    .returning();
  return !!deleted;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LaunchPadBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 2000 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Populate the corpus with curated, real best-in-class ad creatives. Idempotent:
 * skips any seed whose seedKey already exists. Safe to re-run. Runs at startup
 * (in the background) when the corpus is empty, and via the admin re-seed route.
 */
export async function seedReferenceLibrary(): Promise<{ added: number; skipped: number }> {
  const existing = await db.select().from(referenceAssetsTable);
  const existingSeedKeys = new Set(existing.map((r) => r.seedKey).filter(Boolean) as string[]);

  const pending = REFERENCE_SEEDS.filter((s) => !existingSeedKeys.has(s.seedKey));
  if (pending.length === 0) return { added: 0, skipped: REFERENCE_SEEDS.length };

  logger.info({ count: pending.length }, "Seeding reference library");

  let added = 0;
  const CONCURRENCY = 3;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (seed) => {
        const buffer = await fetchImage(seed.imageUrl);
        if (!buffer) {
          logger.warn({ seedKey: seed.seedKey, url: seed.imageUrl }, "Seed image fetch failed — skipping");
          return;
        }
        try {
          await ingestReferenceImage(
            {
              id: seed.seedKey,
              platform: seed.platform,
              source: "curated",
              title: seed.title,
              sourceUrl: seed.sourceUrl,
              seedKey: seed.seedKey,
              buffer,
            },
            { analyzeInline: true },
          );
          added += 1;
        } catch (err) {
          logger.error({ err, seedKey: seed.seedKey }, "Seed ingest failed");
        }
      }),
    );
  }

  const skipped = REFERENCE_SEEDS.length - pending.length;
  logger.info({ added, skipped }, "Reference library seed complete");
  return { added, skipped };
}

/**
 * Re-run analysis for assets stuck in 'analyzing' — e.g. an upload (or seed)
 * whose background analysis was interrupted by a process restart. Reads the
 * already-stored image back from storage so no re-download is needed.
 */
export async function recoverStaleAnalyzing(): Promise<void> {
  let stale: ReferenceAsset[];
  try {
    stale = await db
      .select()
      .from(referenceAssetsTable)
      .where(eq(referenceAssetsTable.status, "analyzing"));
  } catch {
    return;
  }
  if (stale.length === 0) return;
  logger.info({ count: stale.length }, "Recovering stale reference analyses");
  for (const asset of stale) {
    const stored = await getAsset(asset.imageKey);
    if (!stored) {
      await db
        .update(referenceAssetsTable)
        .set({ status: "failed" })
        .where(eq(referenceAssetsTable.id, asset.id));
      continue;
    }
    await runAnalysis(asset.id, stored.buffer, asset.platform, asset.title);
  }
}

/**
 * Seed the corpus in the background at startup if it's empty, otherwise recover
 * any analyses interrupted by a restart. Never throws.
 */
export async function ensureSeededInBackground(): Promise<void> {
  try {
    const [one] = await db.select().from(referenceAssetsTable).limit(1);
    if (!one) {
      void seedReferenceLibrary().catch((err) =>
        logger.error({ err }, "Background reference seed failed"),
      );
      return;
    }
    void recoverStaleAnalyzing().catch((err) =>
      logger.error({ err }, "Stale analysis recovery failed"),
    );
  } catch (err) {
    logger.error({ err }, "Could not check reference corpus for seeding");
  }
}

/**
 * Retrieve relevant indexed reference notes for a brief and format them as a
 * compact text block to append to the generation playbook (RAG). Returns "" if
 * the corpus is empty so the static playbook still works.
 */
export async function getIndexedReferenceNotes(brief: string): Promise<string> {
  let assets: ReferenceAsset[];
  try {
    assets = await db
      .select()
      .from(referenceAssetsTable)
      .where(eq(referenceAssetsTable.status, "ready"));
  } catch {
    return "";
  }
  const ready = assets.filter((a) => a.analysis);
  if (ready.length === 0) return "";

  const tokens = Array.from(
    new Set(
      brief
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4),
    ),
  );

  const scored = ready
    .map((a) => {
      const an = a.analysis as ReferenceAnalysis;
      const hay = [
        a.title ?? "",
        a.platform,
        an.angle,
        an.tone,
        an.format,
        an.hook,
        an.copyPattern,
        (an.visualTokens ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      const score = tokens.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
      return { a, an, score };
    })
    .sort((x, y) => y.score - x.score);

  // Pick up to 6 with platform diversity (max 2 per platform).
  const perPlatform = new Map<string, number>();
  const picked: typeof scored = [];
  for (const item of scored) {
    if (picked.length >= 6) break;
    const used = perPlatform.get(item.a.platform) ?? 0;
    if (used >= 2) continue;
    perPlatform.set(item.a.platform, used + 1);
    picked.push(item);
  }
  if (picked.length === 0) return "";

  const lines = picked.map(({ a, an }) => {
    const tokensStr = (an.visualTokens ?? []).slice(0, 4).join(", ");
    return `- [${platformLabel(a.platform)}] ${a.title ?? "Reference"} — angle: ${an.angle}; visual: ${tokensStr}; copy: ${an.copyPattern}; why: ${an.whyItWorks}`;
  });

  return `\n\nINDEXED REFERENCE CORPUS (real best-in-class ads, vision-analysed and indexed for taste — adapt these patterns to THIS product; never copy any brand's name, layout, or copy verbatim):\n${lines.join("\n")}`;
}
