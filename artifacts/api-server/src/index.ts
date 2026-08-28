import "./loadEnv";
import app from "./app";
import { logger } from "./lib/logger";
import { startWorkerLoop } from "./lib/worker";
import { startSpendGuardLoop } from "./lib/spendGuard";
import { ensureSeededInBackground } from "./lib/referenceAssets";

/**
 * Local / long-running entry. Vercel uses `src/app.ts` (exported Express app)
 * as the service entrypoint — do not listen() on Vercel.
 */
if (process.env.VERCEL) {
  logger.info("Vercel runtime — skipping listen(); src/app.ts is the entrypoint");
} else {
  const rawPort = process.env["PORT"] ?? process.env["API_PORT"] ?? "8080";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
    startWorkerLoop();
    startSpendGuardLoop();
    void ensureSeededInBackground();
  });
}
