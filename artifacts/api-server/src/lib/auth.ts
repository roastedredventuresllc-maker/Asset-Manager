import { createHash, randomBytes } from "crypto";
import { db, magicLinksTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateId } from "./ids.js";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMagicLink(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(magicLinksTable).values({ tokenHash, userId, expiresAt });

  return token;
}

export async function verifyToken(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  const tokenHash = hashToken(token);
  const link = await db.query.magicLinksTable.findFirst({
    where: eq(magicLinksTable.tokenHash, tokenHash),
  });

  if (!link) return null;
  if (link.expiresAt < new Date()) return null;

  const user = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, link.userId),
  });

  if (!user) return null;

  return { userId: user.id, email: user.email };
}

export async function findOrCreateUser(email: string): Promise<string> {
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
  });

  if (existing) return existing.id;

  const id = generateId("usr");
  await db.insert(usersTable).values({ id, email });
  return id;
}
