import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import campaignsRouter from "./campaigns.js";
import jobsRouter from "./jobs.js";
import authRouter from "./auth.js";
import uploadsRouter from "./uploads.js";
import webhooksRouter from "./webhooks.js";
import assetsRouter from "./assets.js";
import mcpRouter from "./mcp.js";
import adminRouter from "./admin.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/campaigns", campaignsRouter);
router.use("/jobs", jobsRouter);
router.use("/auth", authRouter);
router.use("/uploads", uploadsRouter);
router.use("/webhooks", webhooksRouter);
router.use("/assets", assetsRouter);
router.use("/mcp", mcpRouter);
router.use("/admin", adminRouter);

export default router;
