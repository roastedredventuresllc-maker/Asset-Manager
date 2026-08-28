"use strict";
// Placeholder so Vercel can resolve `entrypoint` before buildCommand.
// `scripts/bundle-vercel.mjs` overwrites this with an inlined Express bundle.
const express = require("express");
const app = express();
app.get("/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
app.get("/api/healthz", (_req, res) => {
  res.status(200).json({ status: "ok" });
});
module.exports = app;
