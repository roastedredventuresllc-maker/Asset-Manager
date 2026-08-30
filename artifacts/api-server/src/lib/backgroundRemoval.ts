import { logger } from "./logger.js";

// ── fal.ai BRIA RMBG 2.0 (dedicated BG removal model) ───────────────────────
// Used when AI_INTEGRATIONS_FAL_BASE_URL + AI_INTEGRATIONS_FAL_API_KEY are set,
// or when FAL_KEY / FAL_API_KEY are set directly.
// If credentials are absent the call is skipped and we fall through to Gemini.

const FAL_QUEUE_BASE = "https://queue.fal.run";
const BRIA_PATH = "/fal-ai/bria/background/remove";
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 40; // 60 s total

function falEndpoint(): string {
  const base = process.env.AI_INTEGRATIONS_FAL_BASE_URL;
  return base ? `${base}${BRIA_PATH}` : `${FAL_QUEUE_BASE}${BRIA_PATH}`;
}

function falHeaders(): Record<string, string> {
  const key =
    process.env.AI_INTEGRATIONS_FAL_API_KEY ??
    process.env.FAL_KEY ??
    process.env.FAL_API_KEY ??
    "";
  return {
    "Content-Type": "application/json",
    ...(key ? { Authorization: `Key ${key}` } : {}),
  };
}

function hasFalCredentials(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_FAL_API_KEY ??
    process.env.FAL_KEY ??
    process.env.FAL_API_KEY
  );
}

async function submitFalJob(imageUrl: string): Promise<string> {
  const res = await fetch(falEndpoint(), {
    method: "POST",
    headers: { ...falHeaders(), prefer: "respond-async" },
    body: JSON.stringify({ image_url: imageUrl }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fal submit failed ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = (await res.json()) as
    | { request_id?: string }
    | { images?: Array<{ url: string }>; image?: { url: string } };

  if ("request_id" in body && body.request_id) return body.request_id;

  // Synchronous response (rare but possible)
  const syncUrl =
    (body as { images?: Array<{ url: string }> }).images?.[0]?.url ??
    (body as { image?: { url: string } }).image?.url;
  if (syncUrl) return `__sync__${syncUrl}`;

  throw new Error("fal submit: no request_id or image in response");
}

async function pollFalResult(requestId: string): Promise<string> {
  if (requestId.startsWith("__sync__")) return requestId.slice(8);

  const statusUrl = `${FAL_QUEUE_BASE}/fal-ai/bria/requests/${requestId}`;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const res = await fetch(`${statusUrl}/status`, { headers: falHeaders() });
    if (!res.ok) continue;

    const status = (await res.json()) as { status?: string };
    if (status.status === "COMPLETED") {
      const resultRes = await fetch(statusUrl, { headers: falHeaders() });
      if (!resultRes.ok) throw new Error(`fal result fetch failed ${resultRes.status}`);
      const result = (await resultRes.json()) as {
        images?: Array<{ url: string }>;
        image?: { url: string };
      };
      const imgUrl = result.images?.[0]?.url ?? result.image?.url;
      if (!imgUrl) throw new Error("fal result: no image URL");
      return imgUrl;
    }
    if (status.status === "FAILED" || status.status === "CANCELLED") {
      throw new Error(`fal job ${status.status}`);
    }
  }
  throw new Error("fal background removal timed out");
}

/** Remove background via fal.ai BRIA RMBG 2.0. Returns transparent PNG buffer. */
async function removeWithFal(imageUrl: string): Promise<Buffer> {
  const requestId = await submitFalJob(imageUrl);
  const resultUrl = await pollFalResult(requestId);
  const res = await fetch(resultUrl);
  if (!res.ok) throw new Error(`fal result download failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ── Gemini-based background removal (always available, no extra credentials) ──
// Uses Gemini image editing to extract the subject onto a white background,
// then sharp converts to PNG with alpha channel. Not as precise as BRIA for
// complex edges, but works for typical product photography.

const BG_REMOVAL_PROMPT =
  "Remove the background from this image completely. " +
  "Keep only the main subject/product. " +
  "Replace the background with solid white. " +
  "Preserve all edges and details of the subject precisely. " +
  "No text, no watermarks, no additional elements.";

async function removeWithGemini(imageUrl: string): Promise<Buffer> {
  const { editImage } = await import("@workspace/integrations-gemini-ai/image");
  const { loadSharp } = await import("./loadSharp.js");
  const sharp = await loadSharp();

  // Fetch and normalise the source image to PNG
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`image fetch failed ${res.status}`);
  const sourceBuffer = await sharp(Buffer.from(await res.arrayBuffer()))
    .png()
    .toBuffer();

  const edited = await editImage(
    BG_REMOVAL_PROMPT,
    { data: sourceBuffer, mimeType: "image/png" },
    "1:1",
  );

  // Convert white background → transparency using sharp's threshold trick:
  // create an alpha mask from the luminance of the Gemini result
  const editedRaw = await sharp(edited).raw().toBuffer({ resolveWithObject: true });
  const { data, info } = editedRaw;
  const { width, height, channels } = info;

  // Build RGBA buffer: copy RGB, set alpha=0 where pixel is near-white (BG)
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const src = i * channels;
    const dst = i * 4;
    const r = data[src] ?? 255;
    const g = data[src + 1] ?? 255;
    const b = data[src + 2] ?? 255;
    rgba[dst] = r;
    rgba[dst + 1] = g;
    rgba[dst + 2] = b;
    // Near-white (>240 on all channels) → transparent
    rgba[dst + 3] = r > 240 && g > 240 && b > 240 ? 0 : 255;
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

/**
 * Remove the background from a publicly accessible image URL.
 *
 * Strategy:
 * 1. fal.ai BRIA RMBG 2.0 — best quality, dedicated model. Used when
 *    AI_INTEGRATIONS_FAL_API_KEY / FAL_KEY / FAL_API_KEY env var is set.
 * 2. Gemini image editing — always available (uses existing integration).
 *    Removes BG by prompting Gemini then masking near-white pixels.
 *
 * Returns a transparent PNG Buffer, or null on total failure.
 * Callers should treat null as "use original photo" — never throw.
 */
export async function removeBackground(imageUrl: string): Promise<Buffer | null> {
  // Try fal.ai first if credentials exist
  if (hasFalCredentials()) {
    try {
      const buf = await removeWithFal(imageUrl);
      logger.info({ imageUrl, bytes: buf.length, method: "fal-bria" }, "Background removed");
      return buf;
    } catch (err) {
      logger.warn({ err, imageUrl }, "fal.ai background removal failed — trying Gemini");
    }
  }

  // Gemini fallback (always available in this deployment)
  try {
    const buf = await removeWithGemini(imageUrl);
    logger.info({ imageUrl, bytes: buf.length, method: "gemini" }, "Background removed");
    return buf;
  } catch (err) {
    logger.warn({ err, imageUrl }, "Background removal failed — will use original photo");
    return null;
  }
}
