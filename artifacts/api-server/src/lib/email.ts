import { logger } from "./logger";

export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const domain = process.env.REPLIT_DEV_DOMAIN ?? process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost:5000";
  const url = `https://${domain}/campaigns?token=${token}`;

  // V1: log to console. Hook up a real email provider in v2.
  logger.info({ email, url }, "Magic link email (stub — log only in v1)");
  console.log(`\n✉️  Magic link for ${email}:\n  ${url}\n`);
}
