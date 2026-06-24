import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Load Stripe.js once (singleton). Publishable key only — the secret key never
// reaches the browser; the clientSecret always comes from the backend.
let stripePromise: Promise<Stripe | null> | undefined;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
    );
  }
  return stripePromise;
}
