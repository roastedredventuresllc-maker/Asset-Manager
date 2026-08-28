import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "./databaseUrl";

const { Pool } = pg;

function poolMax(): number {
  const named = Number.parseInt(process.env.PG_POOL_MAX ?? "", 10);
  if (Number.isFinite(named) && named > 0) return named;
  return process.env.VERCEL ? 3 : 10;
}

/**
 * Pool construction must not throw. `/api/healthz` imports this module and
 * does not query Postgres; a missing DATABASE_URL used to crash the whole
 * Express function at import time. drizzle-kit still uses resolveDatabaseUrl()
 * which throws on Vercel/Replit when no URL is set.
 */
function poolConnectionString(): string {
  try {
    return resolveDatabaseUrl();
  } catch (err) {
    if (process.env.VERCEL) {
      console.error(
        err instanceof Error ? err.message : "DATABASE_URL missing on Vercel",
      );
      return "postgres://127.0.0.1:1/launchpad_unconfigured";
    }
    throw err;
  }
}

export const pool = new Pool({
  connectionString: poolConnectionString(),
  max: poolMax(),
});
export const db = drizzle(pool, { schema });

export { resolveDatabaseUrl, LOCAL_COMPOSE_DATABASE_URL } from "./databaseUrl";
export * from "./schema";
