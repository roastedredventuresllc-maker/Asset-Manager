import { Router, type Request, type Response } from "express";
import { db, campaignsTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { findOrCreateUser, createMagicLink } from "../lib/auth.js";
import { sendMagicLinkEmail } from "../lib/email.js";
import { generateId } from "../lib/ids.js";
import { publishCampaignToPlatforms } from "../lib/publish.js";
import { logger } from "../lib/logger.js";

const router = Router();

// POST /api/webhooks/stripe — must use raw body for signature verification
router.post(
  "/stripe",
  async (req: Request, res: Response) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeKey) return res.status(500).json({ error: "Stripe not configured" });

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeKey);

    let event;
    try {
      if (webhookSecret && req.headers["stripe-signature"]) {
        event = stripe.webhooks.constructEvent(
          (req as Request & { rawBody?: Buffer }).rawBody ?? req.body,
          req.headers["stripe-signature"] as string,
          webhookSecret,
        );
      } else {
        event = req.body;
      }
    } catch (err) {
      logger.error({ err }, "Webhook signature verification failed");
      return res.status(400).json({ error: "invalid signature" });
    }

    try {
      await handleStripeEvent(stripe, event);
    } catch (err) {
      logger.error({ err, eventType: event.type }, "Webhook handler error");
      return res.status(500).json({ error: "handler error" });
    }

    return res.json({ received: true });
  },
);

async function handleStripeEvent(stripe: import("stripe").default, event: import("stripe").Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as import("stripe").Stripe.Checkout.Session;
      await handleCheckoutComplete(stripe, session);
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as import("stripe").Stripe.Invoice;
      logger.info({ invoiceId: invoice.id }, "Invoice paid");
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      await db
        .update(subscriptionsTable)
        .set({ status: "canceled" })
        .where(eq(subscriptionsTable.stripeSubscriptionId, sub.id));
      break;
    }
    default:
      logger.info({ type: event.type }, "Unhandled Stripe event");
  }
}

async function handleCheckoutComplete(
  stripe: import("stripe").default,
  session: import("stripe").Stripe.Checkout.Session,
) {
  const { campaignId, dailyBudgetCents, metaSharePct, tiktokSharePct } =
    session.metadata ?? {};

  if (!campaignId) {
    logger.warn({ sessionId: session.id }, "Checkout session missing campaignId");
    return;
  }

  const email = session.customer_email ?? session.customer_details?.email;
  if (!email) {
    logger.warn({ sessionId: session.id }, "No email in checkout session");
    return;
  }

  // 1. Find or create user
  const userId = await findOrCreateUser(email);

  // 2. Claim the campaign for this user
  await db
    .update(campaignsTable)
    .set({ userId })
    .where(eq(campaignsTable.id, campaignId));

  // 3. Upsert subscription
  const stripeSubId = typeof session.subscription === "string"
    ? session.subscription
    : (session.subscription as { id?: string })?.id;

  const subId = generateId("sub");
  await db
    .insert(subscriptionsTable)
    .values({
      id: subId,
      userId,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId: stripeSubId ?? null,
      plan: "live",
      status: "active",
    })
    .onConflictDoUpdate({
      target: subscriptionsTable.userId,
      set: {
        stripeSubscriptionId: stripeSubId ?? undefined,
        status: "active",
      },
    });

  // 4. Fire publishing pipeline (marks campaign live on success)
  await publishCampaignToPlatforms(campaignId, {
    dailyBudgetCents: parseInt(dailyBudgetCents ?? "7500"),
    metaSharePct: parseInt(metaSharePct ?? "60"),
    tiktokSharePct: parseInt(tiktokSharePct ?? "40"),
  });

  // 5. Send magic link email
  const token = await createMagicLink(userId);
  await sendMagicLinkEmail(email, token);

  logger.info({ userId, campaignId, email }, "Checkout complete — campaign live");
}

export default router;
