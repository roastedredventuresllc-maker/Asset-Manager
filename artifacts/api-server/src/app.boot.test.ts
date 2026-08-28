import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import express from "express";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import healthRouter from "./routes/health.js";

const here = dirname(fileURLToPath(import.meta.url));

test("db package constructs the Pool inside getPool, not at import", () => {
  const src = readFileSync(join(here, "../../../lib/db/src/index.ts"), "utf8");
  assert.match(src, /export function getPool/);
  assert.equal(
    /export const pool = new Pool/.test(src),
    false,
    "Pool must be lazy so healthz can boot",
  );
});

test("GET /api/healthz and /healthz return {status:ok} without touching the DB", async () => {
  const app = express();
  app.use(healthRouter);
  app.use("/api", healthRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    for (const path of ["/api/healthz", "/healthz"]) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { status: "ok" });
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
