import express from "express";

const app = express();

app.get(["/healthz", "/api/healthz"], (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
