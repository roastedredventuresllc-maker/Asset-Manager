/**
 * Browser-reachable asset URLs.
 *
 * Locally we return a relative `/api/assets/...` path so the Vite proxy
 * (and the API origin) can serve it over http. Never `https://localhost`
 * (TLS + wrong port vs Vite).
 *
 * On Vercel the product URL and `/api` share one deployment, so relative
 * asset paths still work. PUBLIC_APP_URL / VERCEL_URL are for Stripe,
 * magic links, and landing-page absolute URLs.
 */

function stripHost(raw: string): string {
  return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function replitHost(): string | undefined {
  const raw =
    process.env.REPLIT_DEV_DOMAIN ?? process.env.REPLIT_DOMAINS?.split(",")[0];
  if (!raw) return undefined;
  return stripHost(raw);
}

function vercelHost(): string | undefined {
  const raw = process.env.VERCEL_URL;
  if (!raw) return undefined;
  return stripHost(raw);
}

/** API listen origin — used to fetch relative /api/assets paths server-side. */
export function apiListenOrigin(): string {
  const host = vercelHost();
  if (host) return `https://${host}`;
  const port = process.env.API_PORT ?? process.env.PORT ?? "8080";
  return `http://127.0.0.1:${port}`;
}

/** Browser-facing origin. Local default is Vite, not the API port. */
export function publicOrigin(): string {
  const fromEnv = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const host = vercelHost() ?? replitHost();
  if (host) return `https://${host}`;
  const vitePort = process.env.VITE_DEV_PORT ?? "5173";
  return `http://127.0.0.1:${vitePort}`;
}

export function publicAssetUrl(key: string): string {
  const path = `/api/assets/${key.replace(/^\/+/, "")}`;
  const host = vercelHost() ?? replitHost();
  if (host) {
    const fromEnv = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
    if (fromEnv && !isLoopbackOrigin(fromEnv)) return `${fromEnv}${path}`;
    // Same-origin on Vercel/Replit — relative paths survive the /api rewrite.
    if (vercelHost()) return path;
    return `https://${host}${path}`;
  }
  const fromEnv = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  // Localhost (any scheme/port) must stay relative so the Vite proxy can serve
  // it. Never https://localhost — TLS + wrong port vs Vite 5173.
  if (fromEnv && !isLoopbackOrigin(fromEnv)) {
    return `${fromEnv}${path}`;
  }
  return path;
}

function isLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin.includes("://") ? origin : `http://${origin}`);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(origin);
  }
}

export function resolveFetchableUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${apiListenOrigin()}${path}`;
}
