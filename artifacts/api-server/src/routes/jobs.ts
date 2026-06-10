import { Router } from "express";
import { db, jobsTable, adAssetsTable } from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { processImageJob } from "../lib/imagePipeline.js";
import { logger } from "../lib/logger.js";

const router = Router();

// POST /api/jobs/worker — secured by X-Worker-Secret header
router.post("/worker", async (req, res) => {
  const secret = process.env.WORKER_SECRET;
  if (secret && req.headers["x-worker-secret"] !== secret) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const pendingJobs = await db.query.jobsTable.findMany({
    where: and(
      eq(jobsTable.status, "pending"),
      lte(jobsTable.attempts, 2),
    ),
    limit: 5,
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const job of pendingJobs) {
    processed++;
    await db
      .update(jobsTable)
      .set({ status: "processing", attempts: job.attempts + 1 })
      .where(eq(jobsTable.id, job.id));

    try {
      if (job.type === "generate_image") {
        const payload = job.payload as {
          campaignId: string;
          adAssetId: string;
          idx: number;
          ad: Parameters<typeof processImageJob>[0]["ad"];
          brandName: string;
          productImageUrl?: string | null;
        };
        await processImageJob(payload);
        await db
          .update(jobsTable)
          .set({ status: "done" })
          .where(eq(jobsTable.id, job.id));
        succeeded++;
      } else {
        logger.warn({ jobType: job.type }, "Unknown job type");
        await db
          .update(jobsTable)
          .set({ status: "failed", lastError: "Unknown job type" })
          .where(eq(jobsTable.id, job.id));
        failed++;
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ err, jobId: job.id }, "Job processing failed");
      await db
        .update(jobsTable)
        .set({
          status: job.attempts + 1 >= 2 ? "failed" : "pending",
          lastError: error,
        })
        .where(eq(jobsTable.id, job.id));
      failed++;
    }
  }

  return res.json({ processed, succeeded, failed });
});

export default router;
