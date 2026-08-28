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

test("db Pool construction catches missing DATABASE_URL on Vercel", () => {
  const src = readFileSync(join(here, "../../../lib/db/src/index.ts"), "utf8");
  assert.match(src, /poolConnectionString/);
  assert.match(src, /launchpad_unconfigured/);
});

test("app.ts does not statically import the DB or campaign routes", () => {
  const src = readFileSync(join(here, "app.ts"), "utf8");
  assert.equal(/from ["']@workspace\/db["']/.test(src), false);
  assert.equal(/from ["']\.\/routes\/index/.test(src), false);
  assert.match(src, /healthRouter/);
});

test("health.ts does not import workspace packages", () => {
  const src = readFileSync(join(here, "routes/health.ts"), "utf8");
  assert.equal(/@workspace\//.test(src), false);
});

test("GET /api/healthz returns {status:ok} without touching the DB", async () => {
  const app = express();
  app.use("/api", healthRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
