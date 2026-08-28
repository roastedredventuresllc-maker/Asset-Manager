import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isBlobConfigured,
  uploadBuffer,
  VERCEL_BLOB_REQUIRED_MESSAGE,
} from "./storage.js";

const KEYS = [
  "VERCEL",
  "BLOB_READ_WRITE_TOKEN",
  "VERCEL_BLOB_READ_WRITE_TOKEN",
] as const;

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prev: Record<string, string | undefined> = {};
  for (const k of KEYS) prev[k] = process.env[k];
  for (const k of KEYS) {
    if (!(k in overrides) || overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test("VERCEL=1 alone is not Blob configured", async () => {
  await withEnv(
    {
      VERCEL: "1",
      BLOB_READ_WRITE_TOKEN: undefined,
      VERCEL_BLOB_READ_WRITE_TOKEN: undefined,
    },
    () => {
      assert.equal(isBlobConfigured(), false);
    },
  );
});

test("BLOB_READ_WRITE_TOKEN configures Blob without treating VERCEL as enough", async () => {
  await withEnv(
    {
      VERCEL: undefined,
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test",
    },
    () => {
      assert.equal(isBlobConfigured(), true);
    },
  );
});

test("upload on Vercel without a Blob token fails closed (no /tmp)", async () => {
  await withEnv(
    {
      VERCEL: "1",
      BLOB_READ_WRITE_TOKEN: undefined,
      VERCEL_BLOB_READ_WRITE_TOKEN: undefined,
    },
    async () => {
      await assert.rejects(
        () => uploadBuffer("ad-images/x/0.png", Buffer.from("x"), "image/png"),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.equal(err.message, VERCEL_BLOB_REQUIRED_MESSAGE);
          return true;
        },
      );
    },
  );
});
