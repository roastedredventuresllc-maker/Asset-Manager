import express from "express";

const app = express();

app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export default app;
