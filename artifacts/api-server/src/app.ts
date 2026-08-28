import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import landingRouter from "./routes/landing.js";
import { logger } from "./lib/logger.js";
import { runInBackground } from "./lib/background.js";
import { ensureSeededInBackground } from "./lib/referenceAssets.js";
import { pool } from "@workspace/db";
import { attachDatabasePool } from "@vercel/functions";

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

// On Vercel there is no long-lived listen() process. Seed on first request.
let vercelBootstrapped = false;
app.use((_req, _res, next) => {
  if (process.env.VERCEL && !vercelBootstrapped) {
    vercelBootstrapped = true;
    try {
      attachDatabasePool(pool);
    } catch (err) {
      logger.error({ err }, "Failed to attach Postgres pool");
    }
    runInBackground(ensureSeededInBackground());
  }
  next();
});

// API routes
app.use("/api", router);

// Landing pages at /p/:slug
app.use("/p", landingRouter);

export default app;
