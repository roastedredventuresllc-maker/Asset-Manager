import { Router } from "express";
import { processPendingJobs } from "../lib/worker.js";

const router = Router();

// POST /api/jobs/worker — secured by X-Worker-Secret header.
// Kept for external cron / production triggering; in development the
// in-process worker loop (see startWorkerLoop) drains the queue automatically.
router.post("/worker", async (req, res) => {
  const secret = process.env.WORKER_SECRET;
  if (secret && req.headers["x-worker-secret"] !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const result = await processPendingJobs();
  return res.json(result);
});

export default router;
