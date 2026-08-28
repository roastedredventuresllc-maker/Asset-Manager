import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import healthRouter from "./routes/health.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(cors());
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Must not load campaigns/DB/Grok. Missing env used to crash the whole function.
app.use("/api", healthRouter);

function isHealthz(req: Request): boolean {
  return req.path === "/healthz" || req.path === "/api/healthz";
}

let restLoaded = false;
let restQueue: Promise<void> | null = null;

function loadRest(): Promise<void> {
  if (restLoaded) return Promise.resolve();
  if (!restQueue) {
    restQueue = (async () => {
      const [
        { default: router },
        { default: landingRouter },
        { pool },
        { attachDatabasePool },
        { runInBackground },
        { ensureSeededInBackground },
      ] = await Promise.all([
        import("./routes/index.js"),
        import("./routes/landing.js"),
        import("@workspace/db"),
        import("@vercel/functions"),
        import("./lib/background.js"),
        import("./lib/referenceAssets.js"),
      ]);

      if (process.env.VERCEL) {
        try {
          attachDatabasePool(pool);
        } catch (err) {
          logger.error({ err }, "Failed to attach Postgres pool");
        }
        runInBackground(ensureSeededInBackground());
      }

      app.use("/api", router);
      app.use("/p", landingRouter);
      restLoaded = true;
    })();
  }
  return restQueue;
}

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (isHealthz(req)) return next();
  loadRest().then(() => next()).catch(next);
});

export default app;
