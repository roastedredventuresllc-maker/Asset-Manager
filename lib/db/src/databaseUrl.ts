import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Local docker-compose Postgres (see docker-compose.yml). Not a production
 * secret — house/test only. Must match the api-server test default.
 */
export const LOCAL_COMPOSE_DATABASE_URL =
  "postgres://launchpad:launchpad@127.0.0.1:5432/launchpad";

function parseEnvFile(text: string): void {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined && process.env[key] !== "") continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (val === "") continue;
    process.env[key] = val;
  }
}

function findEnvFile(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Load repo-root `.env` if present. Shell / Replit Secrets win over the file. */
export function loadRootEnv(): void {
  const envFile = findEnvFile();
  if (envFile) parseEnvFile(readFileSync(envFile, "utf8"));
}

/**
 * Resolve DATABASE_URL for drizzle-kit and the Pool.
 * Off Replit, an unset/empty URL falls back to docker-compose Postgres so
 * `pnpm --filter @workspace/db run push` and the API can boot in mock.
 */
export function resolveDatabaseUrl(): string {
  loadRootEnv();
  const existing = process.env.DATABASE_URL?.trim();
  if (existing) {
    process.env.DATABASE_URL = existing;
    return existing;
  }
  if (process.env.REPL_ID) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  process.env.DATABASE_URL = LOCAL_COMPOSE_DATABASE_URL;
  console.warn(
    "DATABASE_URL unset — using local docker-compose Postgres at 127.0.0.1:5432/launchpad. Run `docker compose up -d --wait` first (see README).",
  );
  return LOCAL_COMPOSE_DATABASE_URL;
}
