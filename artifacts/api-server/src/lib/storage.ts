import { logger } from "./logger.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const LOCAL_ASSETS_DIR = "/tmp/launchpad-assets";

async function saveLocally(key: string, buffer: Buffer): Promise<string> {
  const dir = join(LOCAL_ASSETS_DIR, key.split("/").slice(0, -1).join("/"));
  await mkdir(dir, { recursive: true });
  await writeFile(join(LOCAL_ASSETS_DIR, key), buffer);
  // Serve via /api/assets/:key route
  const domain =
    process.env.REPLIT_DEV_DOMAIN ??
    process.env.REPLIT_DOMAINS?.split(",")[0] ??
    "localhost:8080";
  return `https://${domain}/api/assets/${key}`;
}

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  // Try Replit Object Storage first
  try {
    const { Client } = await import("@replit/object-storage");
    const client = new Client();
    await client.uploadFromBytes(key, buffer, { contentType });
    const domain =
      process.env.REPLIT_DEV_DOMAIN ??
      process.env.REPLIT_DOMAINS?.split(",")[0] ??
      "localhost:8080";
    return `https://${domain}/api/assets/${key}`;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg }, "Object storage unavailable — falling back to local filesystem");
  }

  // Local filesystem fallback (dev / no bucket configured)
  return saveLocally(key, buffer);
}

export async function uploadFromUrl(key: string, url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  return uploadBuffer(key, buffer, contentType);
}
