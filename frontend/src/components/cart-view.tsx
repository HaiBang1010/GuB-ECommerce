'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import {
  useCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from '@/hooks/use-cart';
import { useCartStore } from '@/stores/cart.store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPriceCents } from '@/lib/money';
import type { CartItemView } from '@/lib/api/cart';

export function CartView() {
  const t = useTranslations('cart');
  const cart = useCart();

  if (cart.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </main>
    );
  }

  if (cart.isError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>
        <p className="text-destructive">{t('error')}</p>
      </main>
    );
  }

  const items = cart.data.items;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-muted-foreground">{t('empty')}</p>
          <Button asChild variant="outline">
            <Link href="/products">{t('continueShopping')}</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <CartLine key={item.variantId} item={item} />
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-end gap-4 border-t pt-6">
            <p className="text-lg font-semibold">
              {t('total')}: {formatPriceCents(cart.data.subtotalCents)}
            </p>
            <div className="flex gap-3">
              <Button asChild variant="outline">
                <Link href="/products">{t('continueShopping')}</Link>
              </Button>
              <Button asChild>
                <Link href="/checkout">{t('checkout')}</Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

function CartLine({ item }: { item: CartItemView }) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const snapshot = useCartStore((s) => s.snapshots[item.variantId]);
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();

  const name = snapshot
    ? locale === 'vi'
      ? snapshot.nameVi
      : snapshot.nameEn
    : item.sku;
  const busy = update.isPending || remove.isPending;
  const atMax = item.quantity >= item.stockQty;

  return (
    <li className="flex gap-4 border-b pb-4">
      <div className="bg-muted h-20 w-20 shrink-0 overflow-hidden rounded-md">
        {snapshot?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- raw Cloudinary URL; next/image is Phase 7
          <img
            src={snapshot.imageUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        {snapshot?.slug ? (
          <Link
            href={`/products/${snapshot.slug}`}
            className="font-medium hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="font-medium">{name}</span>
        )}
        <span className="text-muted-foreground text-sm">
          {item.size} · {item.color}
        </span>
        <span className="text-sm">{formatPriceCents(item.unitPriceCents)}</span>

        <div className="mt-1 flex items-center gap-2">
          <div className="flex items-center rounded-md border">
            <button
              type="button"
              aria-label={t('decrease')}
              disabled={busy || item.quantity <= 1}
              onClick={() =>
                update.mutate({
                  variantId: item.variantId,
                  quantity: item.quantity - 1,
                })
              }
              className="px-2 py-1 disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-8 text-center text-sm">{item.quantity}</span>
            <button
              type="button"
              aria-label={t('increase')}
              disabled={busy || atMax}
              onClick={() =>
                update.mutate({
                  variantId: item.variantId,
                  quantity: item.quantity + 1,
                })
              }
              className="px-2 py-1 disabled:opacity-40"
            >
              +
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => remove.mutate(item.variantId)}
          >
            {t('remove')}
          </Button>
        </div>
      </div>

      <div className="text-right font-medium">
        {formatPriceCents(item.lineCents)}
      </div>
    </li>
  );
}
