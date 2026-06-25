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

// Reusable Stripe Payment Element step. Used by both checkout (new order) and the
// order detail page (pay-again). The clientSecret ALWAYS comes from the backend.
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
        return_url: `${window.location.origin}/${locale}/orders/${orderId}/confirmation`,
      },
    });

    // confirmPayment only returns here on an immediate error; success redirects.
    if (result.error) {
      setError(result.error.message ?? t('paymentError'));
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
