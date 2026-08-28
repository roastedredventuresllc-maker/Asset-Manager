/** Job row status. Worker writes these; revise must look up the same values. */
export const JOB_STATUS = {
  pending: "pending",
  processing: "processing",
  done: "done",
  failed: "failed",
} as const;

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];
