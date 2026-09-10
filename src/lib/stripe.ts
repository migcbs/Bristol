import Stripe from "stripe";

// `||` (not `??`) so an empty-string env var also falls back to the
// placeholder — `new Stripe("")` throws, which would crash `next build`
// on a deploy that hasn't set the key yet. Payment calls made with the
// placeholder fail at request time, caught by the caller.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-08-26.dahlia",
});
