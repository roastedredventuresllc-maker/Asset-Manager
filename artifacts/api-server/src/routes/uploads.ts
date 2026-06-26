import { Router } from "express";
import { uploadBuffer } from "../lib/storage.js";
import { generateId } from "../lib/ids.js";
import { logger } from "../lib/logger.js";
import { removeBackground } from "../lib/backgroundRemoval.js";

const router = Router();

// POST /api/uploads/product-image
// Accepts base64 data URL (resized client-side to max 1024px JPEG).
// After storing the original, runs background removal via fal.ai BRIA RMBG 2.0
// and stores the transparent PNG at a parallel key. Returns both URLs so the
// image pipeline can use the clean cutout for the hero ad composite.
router.post("/product-image", async (req, res) => {
  const { dataUrl } = req.body as { dataUrl?: string };

  if (!dataUrl || typeof dataUrl !== "string") {
    return res.status(400).json({ error: "dataUrl required" });
  }

  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return res.status(400).json({ error: "invalid dataUrl format" });

  const contentType = match[1] ?? "image/jpeg";
  const base64Data = match[2] ?? "";

  try {
    const buffer = Buffer.from(base64Data, "base64");
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "image too large (max 5MB)" });
    }

    const id = generateId("img");
    const key = `product-images/${id}.jpg`;

    // Optionally re-encode with sharp if available
    let finalBuffer: Buffer = buffer;
    try {
      const { default: sharp } = await import("sharp");
      finalBuffer = await sharp(buffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      // sharp not available, use raw buffer
    }

    const url = await uploadBuffer(key, finalBuffer, contentType);
    logger.info({ key, size: finalBuffer.length }, "Product image uploaded");

    // Fire background removal. This runs concurrently — we respond immediately
    // with `url`, and `noBgUrl` is returned once removal completes (typically
    // 5–15 s). The image pipeline prefers `noBgUrl` when present; callers that
    // pass only `url` to /campaigns/generate will still work (the pipeline
    // fetches & uses the original photo).
    //
    // To give the campaign generator access to the no-bg version, the upload
    // response includes a `noBgUrl` promise result — but the HTTP response is
    // sent immediately so the user sees the preview without waiting. Campaigns
    // that start before BG removal finishes will use the original; we store the
    // no-bg URL so it can be passed explicitly if the caller awaits it.
    const noBgPromise = (async (): Promise<string | null> => {
      const noBgBuffer = await removeBackground(url);
      if (!noBgBuffer) return null;
      const noBgKey = `product-images-nobg/${id}.png`;
      return uploadBuffer(noBgKey, noBgBuffer, "image/png");
    })();

    // Wait up to 30 s for removal before responding; if it takes longer we
    // respond with null noBgUrl and the removal finishes in the background
    // (the result is not used since campaigns have already started with the
    // original). 30 s is enough for almost all fal jobs (median ~8 s).
    const noBgUrl = await Promise.race([
      noBgPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 30_000)),
    ]);

    return res.json({ url, noBgUrl: noBgUrl ?? null });
  } catch (err) {
    logger.error({ err }, "Upload error");
    return res.status(500).json({ error: "upload failed" });
  }
});

export default router;
