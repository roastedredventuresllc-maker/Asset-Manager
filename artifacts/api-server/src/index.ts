import app from "./app";
import { logger } from "./lib/logger";
import { startWorkerLoop } from "./lib/worker";
import { startSpendGuardLoop } from "./lib/spendGuard";
import { ensureSeededInBackground } from "./lib/referenceAssets";

const rawPort = process.env["PORT"] ?? "8080";
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
