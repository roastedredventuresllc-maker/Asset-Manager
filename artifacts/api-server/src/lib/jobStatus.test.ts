import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { JOB_STATUS } from "./jobStatus.js";

const dir = dirname(fileURLToPath(import.meta.url));

test("job status enum is done, not completed", () => {
  assert.equal(JOB_STATUS.done, "done");
  assert.notEqual(JOB_STATUS.done, "completed");
  const worker = readFileSync(join(dir, "worker.ts"), "utf8");
  const svc = readFileSync(join(dir, "campaignService.ts"), "utf8");
  assert.match(worker, /JOB_STATUS\.done/);
  assert.match(svc, /JOB_STATUS\.done/);
  assert.doesNotMatch(svc, /eq\(jobsTable\.status,\s*"completed"\)/);
});
