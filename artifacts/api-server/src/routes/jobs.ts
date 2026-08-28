import { Router, type Request, type Response } from "express";
import { processPendingJobs } from "../lib/worker.js";
import { runSpendGuardOnce } from "../lib/spendGuard.js";

const router = Router();

function workerAuthorized(req: Request): boolean {
  const secrets = [
    process.env.WORKER_SECRET,
    process.env.CRON_SECRET,
  ].filter((s): s is string => Boolean(s && s.length > 0));
  if (secrets.length === 0) return true;

  const headerSecret = req.headers["x-worker-secret"];
  if (typeof headerSecret === "string" && secrets.includes(headerSecret)) {
    return true;
  }
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length);
    if (secrets.includes(token)) return true;
  }
  return false;
}

async function runWorker(_req: Request, res: Response) {
  if (!workerAuthorized(_req)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const result = await processPendingJobs();
  return res.json(result);
}

async function runSpendGuard(_req: Request, res: Response) {
  if (!workerAuthorized(_req)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const result = await runSpendGuardOnce();
  return res.json(result);
}

// POST kept for external cron. GET is what Vercel Cron Jobs send.
router.post("/worker", runWorker);
router.get("/worker", runWorker);
router.post("/spend-guard", runSpendGuard);
router.get("/spend-guard", runSpendGuard);

export default router;
