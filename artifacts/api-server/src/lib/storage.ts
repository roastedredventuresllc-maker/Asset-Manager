import { logger } from "./logger.js";

const BUCKET_ID = process.env.REPLIT_OBJECT_STORAGE_BUCKET_ID ?? "default";

async function getStorageClient() {
  try {
    const { Client } = await import("@replit/object-storage");
    return new Client();
  } catch {
    return null;
  }
}

export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const client = await getStorageClient();
  if (!client) {
    logger.warn("Object storage not available — returning data URL stub");
    return `data:${contentType};base64,${buffer.toString("base64").substring(0, 100)}…`;
  }

  await client.uploadFromBytes(key, buffer, { contentType });
  const domain =
    process.env.REPLIT_DEV_DOMAIN ??
    process.env.REPLIT_DOMAINS?.split(",")[0] ??
    "localhost:5000";
  return `https://${domain}/api/assets/${key}`;
}

export async function uploadFromUrl(key: string, url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "image/png";
  return uploadBuffer(key, buffer, contentType);
}
