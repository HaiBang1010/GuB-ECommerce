'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link, useRouter } from '@/i18n/navigation';
import { useCancelOrder, useOrder, usePaymentIntent } from '@/hooks/use-orders';
import { OrderPayment } from '@/components/order-payment';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPriceCents } from '@/lib/money';

// Durable payment page (its own URL): the clientSecret is restored from the order
// id on every mount, so a tab-switch / refresh / revisit lands back on a working
// card field. Shared by checkout (new order) and pay-again (existing order).
export function PayView({ orderId }: { orderId: string }) {
  const t = useTranslations('pay');
  const tOrder = useTranslations('order');
  const locale = useLocale();
  const router = useRouter();

  const order = useOrder(orderId);
  const awaitingPayment = order.data?.status === 'PENDING_PAYMENT';
  const intent = usePaymentIntent(orderId, awaitingPayment);
  const cancel = useCancelOrder();

  // A PAID order has nothing to pay — the webhook flipped it; send the buyer to
  // the confirmation page (where the poll/summary already lives).
  useEffect(() => {
    if (order.data?.status === 'PAID') {
      router.replace(`/orders/${orderId}/confirmation`);
    }
  }, [order.data?.status, orderId, router]);

  if (order.isPending) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (order.isError) {
    return (
      <main className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-8">
        <p className="text-destructive">{tOrder('error')}</p>
        <Button asChild variant="outline">
          <Link href="/orders">{tOrder('back')}</Link>
        </Button>
      </main>
    );
  }

  const o = order.data;

  if (o.status === 'CANCELLED') {
    return (
      <main className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-4 py-8">
        <h1 className="text-2xl font-semibold">{t('orderCancelled')}</h1>
        <Button asChild variant="outline">
          <Link href="/products">{tOrder('continueShopping')}</Link>
        </Button>
      </main>
    );
  }

  if (o.status !== 'PENDING_PAYMENT') {
    // PAID (redirecting via the effect) or any other terminal state — render a
    // placeholder rather than a stale card.
    return (
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="h-8 w-48" />
      </main>
    );
  }

  const itemCount = o.items.reduce((sum, i) => sum + i.quantity, 0);

  function handleCancel() {
    if (!window.confirm(tOrder('cancelConfirm'))) return;
    cancel.mutate(orderId, {
      onSuccess: () => {
        toast.success(tOrder('cancelled'));
        router.push('/orders');
      },
      onError: () => toast.error(tOrder('cancelError')),
    });
  }

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
      {/* LEFT — order summary + reservation notice */}
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">#{o.id.slice(-8)}</p>
        <p className="bg-muted rounded-md p-3 text-sm">
          {t('heldStock', { count: itemCount })}
        </p>
        <ul className="flex flex-col gap-2 border-t pt-4">
          {o.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-2 text-sm">
              <span>
                {locale === 'vi' ? item.productNameVi : item.productNameEn} ·{' '}
                {item.size}/{item.color} × {item.quantity}
              </span>
              <span>
                {formatPriceCents(item.unitPriceCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-3 text-lg font-semibold">
          <span>{tOrder('total')}</span>
          <span>{formatPriceCents(o.totalCents)}</span>
        </div>
      </section>

      {/* RIGHT — payment + cancel */}
      <section className="flex flex-col gap-4">
        {intent.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : intent.isError || !intent.data ? (
          <p className="text-destructive text-sm">{tOrder('payError')}</p>
        ) : (
          <OrderPayment orderId={o.id} clientSecret={intent.data.clientSecret} />
        )}

        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={cancel.isPending}
          onClick={handleCancel}
        >
          {t('cancelOrder')}
        </Button>
      </section>
    </main>
  );
}
