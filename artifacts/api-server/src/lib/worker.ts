import { db, jobsTable } from "@workspace/db";
import { eq, and, lte, desc, inArray, sql } from "drizzle-orm";
import { processImageJob } from "./imagePipeline.js";
import { logger } from "./logger.js";
import { JOB_STATUS } from "./jobStatus.js";

const MAX_ATTEMPTS = 2;
/** Vercel can freeze mid-job; reclaim processing rows older than this. */
const STALE_PROCESSING_MS = 90_000;

export interface WorkerResult {
  processed: number;
  succeeded: number;
  failed: number;
}

async function reclaimStaleProcessingJobs(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  await db
    .update(jobsTable)
    .set({ status: JOB_STATUS.pending })
    .where(
      and(eq(jobsTable.status, JOB_STATUS.processing), lte(jobsTable.updatedAt, cutoff)),
    );
}

/**
 * Drain a batch of pending jobs. Shared by the in-process loop and the
 * POST /api/jobs/worker endpoint (the latter is kept for external cron use).
 */
export async function processPendingJobs(
  limit = 5,
  opts?: { jobIds?: string[]; campaignId?: string },
): Promise<WorkerResult> {
  await reclaimStaleProcessingJobs();

  const pendingWhere = opts?.jobIds?.length
    ? and(
        inArray(jobsTable.id, opts.jobIds),
        eq(jobsTable.status, JOB_STATUS.pending),
      )
    : opts?.campaignId
      ? and(
          eq(jobsTable.status, JOB_STATUS.pending),
          sql`${jobsTable.payload}->>'campaignId' = ${opts.campaignId}`,
        )
      : and(
          eq(jobsTable.status, JOB_STATUS.pending),
          lte(jobsTable.attempts, MAX_ATTEMPTS),
        );

  const pendingJobs = await db.query.jobsTable.findMany({
    where: pendingWhere,
    orderBy: [desc(jobsTable.createdAt)],
    limit,
  });

  // Process the batch concurrently — image generation is I/O-bound and slow
  // (~15-20s each), so running the 3 ad images in parallel keeps the whole
  // campaign under the latency budget instead of summing each one.
  const results = await Promise.all(
    pendingJobs.map(async (job): Promise<"succeeded" | "failed" | "skipped"> => {
      const claimed = await db
        .update(jobsTable)
        .set({ status: JOB_STATUS.processing, attempts: job.attempts + 1 })
        .where(and(eq(jobsTable.id, job.id), eq(jobsTable.status, JOB_STATUS.pending)))
        .returning({ id: jobsTable.id });
      if (claimed.length === 0) return "skipped";

      try {
        if (job.type === "generate_image") {
          const payload = job.payload as Parameters<typeof processImageJob>[0];
          await processImageJob(payload);
          await db
            .update(jobsTable)
            .set({ status: JOB_STATUS.done })
            .where(eq(jobsTable.id, job.id));
          return "succeeded";
        }

        logger.warn({ jobType: job.type }, "Unknown job type");
        await db
          .update(jobsTable)
          .set({ status: JOB_STATUS.failed, lastError: "Unknown job type" })
          .where(eq(jobsTable.id, job.id));
        return "failed";
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error({ err, jobId: job.id }, "Job processing failed");
        // Image jobs already ran Imagine once + gpt-image-2 once. Do not retry.
        const failNow =
          job.type === "generate_image" || job.attempts + 1 >= MAX_ATTEMPTS;
        await db
          .update(jobsTable)
          .set({
            status: failNow ? JOB_STATUS.failed : JOB_STATUS.pending,
            lastError: error,
          })
          .where(eq(jobsTable.id, job.id));
        return "failed";
      }
    }),
  );

  const succeeded = results.filter((r) => r === "succeeded").length;
  const failed = results.filter((r) => r === "failed").length;
  return {
    processed: succeeded + failed,
    succeeded,
    failed,
  };
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
