import { Router } from "express";
import { uploadBuffer } from "../lib/storage.js";
import { generateId } from "../lib/ids.js";
import { logger } from "../lib/logger.js";

const router = Router();

// POST /api/uploads/product-image
// Accepts base64 data URL (resized client-side to max 1024px JPEG)
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

    const key = `product-images/${generateId("img")}.jpg`;

    // Optionally re-encode with sharp if available
    let finalBuffer = buffer;
    try {
      const { default: sharp } = await import("sharp");
      finalBuffer = await sharp(buffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      // sharp not available, use raw buffer
    }

    const url = await uploadBuffer(key, finalBuffer, "image/jpeg");
    logger.info({ key, size: finalBuffer.length }, "Product image uploaded");

    return res.json({ url });
  } catch (err) {
    logger.error({ err }, "Upload error");
    return res.status(500).json({ error: "upload failed" });
  }
});

export default router;
