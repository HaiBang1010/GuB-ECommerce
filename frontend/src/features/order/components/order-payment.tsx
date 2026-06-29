'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

import { getStripe } from '@/lib/stripe';
import { Button } from '@/components/ui/button';

// Load Stripe once, outside render (Stripe's recommendation).
const stripePromise = getStripe();

// Reusable Stripe Payment Element step, rendered on the durable pay page
// (/account/orders/[id]/pay). The clientSecret ALWAYS comes from the backend; a decline
// keeps the buyer on this form to retry another card (no redirect, no cancel).
export function OrderPayment({
  orderId,
  clientSecret,
}: {
  orderId: string;
  clientSecret: string;
}) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentForm orderId={orderId} />
    </Elements>
  );
}

function PaymentForm({ orderId }: { orderId: string }) {
  const t = useTranslations('checkout');
  const tPay = useTranslations('pay');
  const locale = useLocale();
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${locale}/account/orders/${orderId}/confirmation`,
      },
    });

    // confirmPayment only returns here on an immediate error; success redirects.
    // The buyer stays on the form — a declined/invalid card shows a clear retry
    // hint (localized; Stripe's own message is English-only), everything else is
    // treated as a system error. Same intent → unlimited retries.
    if (result.error) {
      const declined =
        result.error.type === 'card_error' ||
        result.error.type === 'validation_error';
      setError(declined ? tPay('cardDeclined') : t('paymentError'));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button
        size="lg"
        onClick={handlePay}
        disabled={!stripe || !elements || submitting}
      >
        {submitting ? t('processing') : t('payNow')}
      </Button>
    </div>
  );
}
