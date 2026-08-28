import { logger } from "./logger.js";
import { publicAssetUrl, resolveFetchableUrl } from "./assetUrl.js";
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

function blobConfigured(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL_BLOB_READ_WRITE_TOKEN ||
      process.env.VERCEL,
  );
}

/**
 * Construct a Replit Object Storage client bound to the provisioned bucket.
 * Kept as a fallback when REPL_ID / a bucket is present. Vercel Blob is primary.
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
  return publicAssetUrl(key);
}

async function saveToBlob(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string | null> {
  if (!blobConfigured()) return null;
  try {
    const { put } = await import("@vercel/blob");
    await put(key, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return publicAssetUrl(key);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg, key }, "Vercel Blob upload failed");
    return null;
  }
}

async function readFromBlob(key: string): Promise<Buffer | null> {
  if (!blobConfigured()) return null;
  try {
    const { head } = await import("@vercel/blob");
    const meta = await head(key);
    if (!meta?.url) return null;
    const res = await fetch(meta.url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const blobUrl = await saveToBlob(key, buffer, contentType);
  if (blobUrl) return blobUrl;

  // Replit Object Storage fallback (REPL_ID / provisioned bucket)
  try {
    const client = await objectClient();
    void contentType;
    await client.uploadFromBytes(key, buffer);
    return publicAssetUrl(key);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ msg }, "Object storage unavailable — falling back to local filesystem");
  }

  return saveLocally(key, buffer);
}

export async function uploadFromUrl(key: string, url: string): Promise<string> {
  const res = await fetch(resolveFetchableUrl(url));
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  return uploadBuffer(key, buffer, contentType);
}

/**
 * Fetch a stored asset by key. Local filesystem first (same-instance /tmp),
 * then Vercel Blob, then Replit Object Storage. Returns null if not found.
 * Rejects path traversal.
 */
export async function getAsset(
  key: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const contentType = contentTypeFor(key);

  const safeKey = normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  if (safeKey.includes("..")) return null;

  try {
    const buffer = await readFile(join(LOCAL_ASSETS_DIR, safeKey));
    return { buffer, contentType };
  } catch {
    // fall through
  }

  const fromBlob = await readFromBlob(safeKey);
  if (fromBlob) return { buffer: fromBlob, contentType };

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
