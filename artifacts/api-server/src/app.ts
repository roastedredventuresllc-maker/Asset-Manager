import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import landingRouter from "./routes/landing.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());

// Stripe webhooks need raw body for signature verification
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/api/webhooks/stripe") {
    express.raw({ type: "application/json" })(req, res, (err) => {
      if (err) return next(err);
      (req as Request & { rawBody?: Buffer }).rawBody = req.body as Buffer;
      next();
    });
  } else {
    express.json({ limit: "10mb" })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", router);

// Landing pages at /p/:slug
app.use("/p", landingRouter);

export default app;
