import type { Context } from "@netlify/functions";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-03-31.basil",
});

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";

async function recordDonation(donation: Record<string, unknown>) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/donations`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(donation),
    });

    if (!res.ok) {
      console.error("Supabase insert error:", await res.text());
    } else {
      console.log("Donation recorded:", donation.donor_name, "$" + donation.amount);
    }
  } catch (err) {
    console.error("Failed to record donation:", err);
  }
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    const body = await req.text();
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await recordDonation({
      stripe_session_id: session.id,
      amount: Number(session.metadata?.amount || 0),
      donor_name: session.metadata?.donor_name || "Anonymous",
      user_id: session.metadata?.user_id || null,
      payment_method: session.payment_method_types?.[0] || "card",
      status: "completed",
      email: session.customer_details?.email || null,
    });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    await recordDonation({
      stripe_session_id: intent.id,
      amount: Number(intent.metadata?.amount || (intent.amount / 100)),
      donor_name: intent.metadata?.donor_name || "Anonymous",
      user_id: intent.metadata?.user_id || null,
      payment_method: intent.payment_method_types?.[0] || "card",
      status: "completed",
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
};
