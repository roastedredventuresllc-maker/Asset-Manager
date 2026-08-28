/**
 * Browser-reachable asset URLs.
 *
 * Locally we return a relative `/api/assets/...` path so the Vite proxy
 * (and the API origin) can serve it over http. Never `https://localhost`
 * (TLS + wrong port vs Vite).
 *
 * Browser-facing origin (Stripe success, magic links) is Vite locally.
 * Server-side fetches resolve relative paths against the API listen address.
 */

function replitHost(): string | undefined {
  const raw =
    process.env.REPLIT_DEV_DOMAIN ?? process.env.REPLIT_DOMAINS?.split(",")[0];
  if (!raw) return undefined;
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** API listen origin — used to fetch relative /api/assets paths server-side. */
export function apiListenOrigin(): string {
  const port = process.env.API_PORT ?? process.env.PORT ?? "8080";
  return `http://127.0.0.1:${port}`;
}

/** Browser-facing origin. Local default is Vite, not the API port. */
export function publicOrigin(): string {
  const fromEnv = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = replitHost();
  if (host) return `https://${host}`;
  const vitePort = process.env.VITE_DEV_PORT ?? "5173";
  return `http://127.0.0.1:${vitePort}`;
}

export function publicAssetUrl(key: string): string {
  const path = `/api/assets/${key.replace(/^\/+/, "")}`;
  if (process.env.PUBLIC_APP_URL || replitHost()) {
    return `${publicOrigin()}${path}`;
  }
  return path;
}

export function resolveFetchableUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${apiListenOrigin()}${path}`;
}
