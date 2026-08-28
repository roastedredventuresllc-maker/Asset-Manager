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

let cachedPool: pg.Pool | undefined;
let cachedDb: ReturnType<typeof drizzle> | undefined;

/** Construct the Pool on first use so `/api/healthz` can boot without DATABASE_URL. */
export function getPool(): pg.Pool {
  if (!cachedPool) {
    cachedPool = new Pool({
      connectionString: resolveDatabaseUrl(),
      max: poolMax(),
    });
  }
  return cachedPool;
}

export function getDb() {
  if (!cachedDb) {
    cachedDb = drizzle(getPool(), { schema });
  }
  return cachedDb;
}

function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const real = resolve();
      const value = Reflect.get(real, prop, real);
      return typeof value === "function" ? (value as Function).bind(real) : value;
    },
    set(_target, prop, value) {
      return Reflect.set(resolve(), prop, value);
    },
    has(_target, prop) {
      return Reflect.has(resolve(), prop);
    },
  });
}

export const pool: pg.Pool = lazy(getPool);
export const db = lazy(getDb);

export { resolveDatabaseUrl, LOCAL_COMPOSE_DATABASE_URL } from "./databaseUrl";
export * from "./schema";
