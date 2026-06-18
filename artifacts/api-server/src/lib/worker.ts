import { db, jobsTable } from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { processImageJob } from "./imagePipeline.js";
import { logger } from "./logger.js";

const MAX_ATTEMPTS = 2;

export interface WorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Drain a batch of pending jobs. Shared by the in-process loop and the
 * POST /api/jobs/worker endpoint (the latter is kept for external cron use).
 */
export async function processPendingJobs(limit = 5): Promise<WorkerResult> {
  const pendingJobs = await db.query.jobsTable.findMany({
    where: and(
      eq(jobsTable.status, "pending"),
      lte(jobsTable.attempts, MAX_ATTEMPTS),
    ),
    limit,
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
        const payload = job.payload as Parameters<typeof processImageJob>[0];
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
          status: job.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending",
          lastError: error,
        })
        .where(eq(jobsTable.id, job.id));
      failed++;
    }
  }

  return { processed, succeeded, failed };
}

let running = false;

/**
 * Start an in-process loop that drains the job queue on an interval.
 * Guards against overlapping runs so a slow batch never stacks up.
 */
export function startWorkerLoop(intervalMs = 2000): void {
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const result = await processPendingJobs();
      if (result.processed > 0) {
        logger.info(result, "Worker drained jobs");
      }
    } catch (err) {
      logger.error({ err }, "Worker loop error");
    } finally {
      running = false;
    }
  }, intervalMs);

  logger.info({ intervalMs }, "In-process image worker started");
}
