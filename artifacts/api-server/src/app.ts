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

// Stripe webhook needs raw body for signature verification — must come BEFORE express.json()
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));

// Everything else gets JSON parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Healthz must not import the DB (or the rest of the API). Missing DATABASE_URL
// used to crash the whole Express function at module load, including /api/healthz.
app.use(healthRouter);
app.use("/api", healthRouter);

let restReady: Promise<void> | null = null;

function loadRest(): Promise<void> {
  if (!restReady) {
    restReady = (async () => {
      const [
        { default: router },
        { default: landingRouter },
        { getPool },
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
          attachDatabasePool(getPool());
          runInBackground(ensureSeededInBackground());
        } catch (err) {
          logger.error({ err }, "Failed to attach Postgres pool");
        }
      }

      app.use("/api", router);
      app.use("/p", landingRouter);
    })();
  }
  return restReady;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  if (path === "/healthz" || path === "/api/healthz") {
    return next();
  }
  loadRest().then(() => next()).catch(next);
});

export default app;
