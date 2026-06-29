'use client';

import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useOrder } from '@/features/order/hooks/use-orders';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPriceCents } from '@/lib/money';

export function ConfirmationView({ orderId }: { orderId: string }) {
  const t = useTranslations('order');
  const locale = useLocale();
  const params = useSearchParams();
  const stripeFailed = params.get('redirect_status') === 'failed';

  const order = useOrder(orderId);

  if (order.isPending) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <Skeleton className="h-8 w-64" />
      </main>
    );
  }

  if (order.isError) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-12">
        <p className="text-destructive">{t('failed')}</p>
        <Button asChild variant="outline">
          <Link href="/cart">{t('continueShopping')}</Link>
        </Button>
      </main>
    );
  }

  const o = order.data;
  const paid = o.status === 'PAID';
  const showFailed = stripeFailed && !paid;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
      {paid ? (
        <>
          <h1 className="text-2xl font-semibold">{t('confirmed')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('orderId')}: {o.id}
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
            <span>{t('total')}</span>
            <span>{formatPriceCents(o.totalCents)}</span>
          </div>
        </>
      ) : showFailed ? (
        <h1 className="text-2xl font-semibold">{t('failed')}</h1>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">{t('processing')}</h1>
          <Skeleton className="h-4 w-48" />
        </>
      )}

      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/account/orders">{t('viewOrders')}</Link>
        </Button>
        <Button asChild>
          <Link href="/products">{t('continueShopping')}</Link>
        </Button>
      </div>
    </main>
  );
}
