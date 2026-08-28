/**
 * Local / long-running entry. Vercel uses `src/app.ts` as the Express
 * entrypoint. Do not statically import the DB/worker graph here — a Vercel
 * bundle that includes this file would crash `/api/healthz` at import time.
 */
if (!process.env.VERCEL) {
  void bootLocal();
}

async function bootLocal(): Promise<void> {
  await import("./loadEnv.js");
  const { default: app } = await import("./app.js");
  const { logger } = await import("./lib/logger.js");
  const { startWorkerLoop } = await import("./lib/worker.js");
  const { startSpendGuardLoop } = await import("./lib/spendGuard.js");
  const { ensureSeededInBackground } = await import("./lib/referenceAssets.js");

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
