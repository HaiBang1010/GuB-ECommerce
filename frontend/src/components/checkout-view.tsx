'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

import { Link } from '@/i18n/navigation';
import { getStripe } from '@/lib/stripe';
import { useAddresses, useCreateAddress } from '@/hooks/use-addresses';
import { useCart } from '@/hooks/use-cart';
import { useCreateOrder } from '@/hooks/use-orders';
import { useCartStore } from '@/stores/cart.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPriceCents } from '@/lib/money';

// Load Stripe once, outside render (Stripe's recommendation).
const stripePromise = getStripe();

const addressSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  line1: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
});
type AddressValues = z.infer<typeof addressSchema>;
const ADDRESS_FIELDS = ['fullName', 'phone', 'line1', 'city', 'country'] as const;

export function CheckoutView() {
  const t = useTranslations('checkout');

  const addresses = useAddresses();
  const cart = useCart();
  const createAddr = useCreateAddress();
  const createOrder = useCreateOrder();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { country: 'VN' },
  });

  // Preselect the default (or first) address once they load.
  useEffect(() => {
    if (
      selectedAddressId === null &&
      addresses.data &&
      addresses.data.length > 0
    ) {
      const def = addresses.data.find((a) => a.isDefault) ?? addresses.data[0];
      setSelectedAddressId(def.id);
    }
  }, [addresses.data, selectedAddressId]);

  async function onCreateAddress(values: AddressValues) {
    const created = await createAddr.mutateAsync(values);
    setSelectedAddressId(created.id);
    setShowForm(false);
    form.reset({ country: 'VN' });
  }

  function handlePlaceOrder() {
    if (!selectedAddressId) return;
    createOrder.mutate(selectedAddressId, {
      onSuccess: ({ order, clientSecret: cs }) => {
        setOrderId(order.id);
        setClientSecret(cs);
      },
    });
  }

  const items = cart.data?.items ?? [];
  const cartEmpty = !cart.isPending && items.length === 0;
  const canPlaceOrder =
    selectedAddressId !== null && items.length > 0 && !createOrder.isPending;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
      {/* LEFT — shipping address */}
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <h2 className="text-lg font-medium">{t('shippingAddress')}</h2>

        {addresses.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {addresses.data && addresses.data.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {addresses.data.map((addr) => (
                  <li key={addr.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                      <input
                        type="radio"
                        name="address"
                        className="mt-1"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                      />
                      <span className="text-sm">
                        <span className="font-medium">{addr.fullName}</span> ·{' '}
                        {addr.phone}
                        <br />
                        {addr.line1}, {addr.city}, {addr.country}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t('selectAddress')}
              </p>
            )}

            {showForm ? (
              <form
                onSubmit={form.handleSubmit(onCreateAddress)}
                className="flex flex-col gap-3"
                noValidate
              >
                {ADDRESS_FIELDS.map((field) => (
                  <div key={field} className="flex flex-col gap-1.5">
                    <Label htmlFor={`addr-${field}`}>{t(field)}</Label>
                    <Input id={`addr-${field}`} {...form.register(field)} />
                    {form.formState.errors[field] ? (
                      <p className="text-destructive text-sm">{t('required')}</p>
                    ) : null}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={createAddr.isPending}>
                    {t('saveAddress')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForm(false)}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowForm(true)}
              >
                {t('addAddress')}
              </Button>
            )}
          </>
        )}
      </section>

      {/* RIGHT — order summary + payment */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t('orderSummary')}</h2>

        {cart.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : cartEmpty ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground">{t('emptyCart')}</p>
            <Button asChild variant="outline">
              <Link href="/products">{t('continueShopping')}</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <SummaryLine
                  key={item.variantId}
                  variantId={item.variantId}
                  sku={item.sku}
                  size={item.size}
                  color={item.color}
                  quantity={item.quantity}
                  lineCents={item.lineCents}
                />
              ))}
            </ul>
            <div className="flex justify-between border-t pt-3 text-lg font-semibold">
              <span>{t('total')}</span>
              <span>{formatPriceCents(cart.data?.subtotalCents ?? 0)}</span>
            </div>

            {clientSecret && orderId ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutPaymentForm orderId={orderId} />
              </Elements>
            ) : (
              <>
                <Button
                  size="lg"
                  disabled={!canPlaceOrder}
                  onClick={handlePlaceOrder}
                >
                  {createOrder.isPending ? t('processing') : t('placeOrder')}
                </Button>
                {createOrder.isError ? (
                  <p className="text-destructive text-sm">{t('paymentError')}</p>
                ) : null}
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function SummaryLine({
  variantId,
  sku,
  size,
  color,
  quantity,
  lineCents,
}: {
  variantId: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  lineCents: number;
}) {
  const locale = useLocale();
  const snapshot = useCartStore((s) => s.snapshots[variantId]);
  const name = snapshot
    ? locale === 'vi'
      ? snapshot.nameVi
      : snapshot.nameEn
    : sku;

  return (
    <li className="flex justify-between gap-2 text-sm">
      <span>
        {name} · {size}/{color} × {quantity}
      </span>
      <span>{formatPriceCents(lineCents)}</span>
    </li>
  );
}

function CheckoutPaymentForm({ orderId }: { orderId: string }) {
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
