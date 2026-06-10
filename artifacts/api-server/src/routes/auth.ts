import { Router } from "express";
import { verifyToken } from "../lib/auth.js";

const router = Router();

// GET /api/auth/verify?token=XXX
router.get("/verify", async (req, res) => {
  const { token } = req.query as { token?: string };
  if (!token) return res.status(400).json({ error: "token required" });

  const result = await verifyToken(token);
  if (!result) return res.status(401).json({ error: "invalid or expired token" });

  return res.json({ userId: result.userId, email: result.email });
});

export default router;
