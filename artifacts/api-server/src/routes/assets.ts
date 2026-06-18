import { Router } from "express";
import { getAsset } from "../lib/storage.js";

const router = Router();

// GET /api/assets/<key> — serves stored ad images. The key contains slashes
// (e.g. ad-images/<campaignId>/0.png), so we read it from req.path rather than
// a single route param.
router.get(/.*/, async (req, res) => {
  const key = decodeURIComponent(req.path.replace(/^\/+/, ""));
  if (!key) return res.status(404).json({ error: "not found" });

  const asset = await getAsset(key);
  if (!asset) return res.status(404).json({ error: "not found" });

  res.setHeader("Content-Type", asset.contentType);
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.send(asset.buffer);
});

export default router;
