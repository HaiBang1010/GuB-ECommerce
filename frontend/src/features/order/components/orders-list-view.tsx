'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useMyOrders } from '@/features/order/hooks/use-orders';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPriceCents } from '@/lib/money';
import { formatDate } from '@/lib/datetime';

export function OrdersListView() {
  const t = useTranslations('order');
  const locale = useLocale();
  const orders = useMyOrders();

  if (orders.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">{t('myOrders')}</h1>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </main>
    );
  }

  if (orders.isError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">{t('myOrders')}</h1>
        <p className="text-destructive">{t('error')}</p>
      </main>
    );
  }

  // Newest first — ISO timestamps sort lexicographically in chronological order.
  const data = [...orders.data].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('myOrders')}</h1>

      {data.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-muted-foreground">{t('noOrders')}</p>
          <Button asChild variant="outline">
            <Link href="/products">{t('continueShopping')}</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((o) => {
            const count = o.items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <li
                key={o.id}
                className="rounded-md border transition-colors hover:bg-accent"
              >
                <Link href={`/account/orders/${o.id}`} className="block p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">#{o.id.slice(-8)}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-sm">
                    <span>
                      {formatDate(o.createdAt, locale)} · {t('items', { count })}
                    </span>
                    <span className="text-foreground font-semibold">
                      {formatPriceCents(o.totalCents)}
                    </span>
                  </div>
                </Link>
                {o.status === 'PENDING_PAYMENT' ? (
                  <Link
                    href={`/account/orders/${o.id}/pay`}
                    className="text-primary block px-4 pb-3 text-sm font-medium"
                  >
                    {t('completePayment')} →
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
