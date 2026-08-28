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

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
  max: poolMax(),
});
export const db = drizzle(pool, { schema });

export { resolveDatabaseUrl, LOCAL_COMPOSE_DATABASE_URL } from "./databaseUrl";
export * from "./schema";
