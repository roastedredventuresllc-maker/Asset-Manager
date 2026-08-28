import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveDatabaseUrl,
  LOCAL_COMPOSE_DATABASE_URL,
} from "@workspace/db";

const KEYS = ["DATABASE_URL", "VERCEL", "REPL_ID"] as const;

function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const prev: Record<string, string | undefined> = {};
  for (const k of KEYS) prev[k] = process.env[k];
  for (const k of KEYS) {
    if (!(k in overrides) || overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    fn();
  } finally {
    for (const k of KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test("Vercel uses DATABASE_URL when set", () => {
  withEnv(
    {
      VERCEL: "1",
      REPL_ID: undefined,
      DATABASE_URL: "postgres://neon.example/launchpad?sslmode=require",
    },
    () => {
      assert.equal(
        resolveDatabaseUrl(),
        "postgres://neon.example/launchpad?sslmode=require",
      );
    },
  );
});

test("Vercel requires DATABASE_URL (no docker-compose fallback)", () => {
  withEnv(
    {
      VERCEL: "1",
      REPL_ID: undefined,
      DATABASE_URL: undefined,
    },
    () => {
      assert.throws(() => resolveDatabaseUrl(), /DATABASE_URL must be set on Vercel/);
    },
  );
});

test("REPL_ID still requires DATABASE_URL", () => {
  withEnv(
    {
      VERCEL: undefined,
      REPL_ID: "repl-1",
      DATABASE_URL: undefined,
    },
    () => {
      assert.throws(() => resolveDatabaseUrl(), /DATABASE_URL must be set on Replit/);
    },
  );
});

test("local mock falls back to compose Postgres", () => {
  withEnv(
    {
      VERCEL: undefined,
      REPL_ID: undefined,
      DATABASE_URL: undefined,
    },
    () => {
      assert.equal(resolveDatabaseUrl(), LOCAL_COMPOSE_DATABASE_URL);
    },
  );
});
