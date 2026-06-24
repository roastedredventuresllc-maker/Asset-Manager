import { logger } from "./logger.js";
import { writeFile, mkdir, readFile } from "fs/promises";
import { join, normalize, extname } from "path";

const LOCAL_ASSETS_DIR = "/tmp/launchpad-assets";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function contentTypeFor(key: string): string {
  return CONTENT_TYPES[extname(key).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Construct a Replit Object Storage client bound to the provisioned bucket.
 * The bucket id is injected via DEFAULT_OBJECT_STORAGE_BUCKET_ID (set when the
 * bucket is provisioned); without it the client has no default bucket and every
 * call fails, forcing the ephemeral local fallback.
 */
async function objectClient() {
  const { Client } = await import("@replit/object-storage");
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  return bucketId ? new Client({ bucketId }) : new Client();
}

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
    const client = await objectClient();
    void contentType; // Object Storage infers content type from the key
    await client.uploadFromBytes(key, buffer);
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

/**
 * Fetch a stored asset by key. Tries the local filesystem first (where
 * uploadBuffer writes when no bucket is configured), then Replit Object
 * Storage. Returns null if not found anywhere. Rejects path traversal.
 */
export async function getAsset(
  key: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const contentType = contentTypeFor(key);

  // Guard against path traversal (e.g. ../../etc/passwd)
  const safeKey = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  if (safeKey.includes("..")) return null;

  // Local filesystem (primary in dev / no bucket)
  try {
    const buffer = await readFile(join(LOCAL_ASSETS_DIR, safeKey));
    return { buffer, contentType };
  } catch {
    // fall through to object storage
  }

  // Replit Object Storage (production with a bucket)
  try {
    const client = await objectClient();
    const result = (await client.downloadAsBytes(safeKey)) as {
      ok?: boolean;
      value?: Buffer[] | Buffer;
    };
    const bytes = Array.isArray(result?.value) ? result.value[0] : result?.value;
    if (result?.ok && bytes) {
      return { buffer: Buffer.from(bytes), contentType };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg, key: safeKey }, "Object storage download failed");
  }

  return null;
}
