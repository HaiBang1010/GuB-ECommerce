'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Link, useRouter } from '@/i18n/navigation';
import { useCancelOrder, useOrder } from '@/features/order/hooks/use-orders';
import {
  useCreateReview,
  useProductReviews,
  useUpdateReview,
} from '@/hooks/use-reviews';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { StarRating } from '@/components/star-rating';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { formatPriceCents } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/datetime';
import { useAuthStore } from '@/stores/auth.store';

export function OrderDetailView({ orderId }: { orderId: string }) {
  const t = useTranslations('order');
  const tPay = useTranslations('pay');
  const tReview = useTranslations('reviews');
  const locale = useLocale();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const order = useOrder(orderId);
  const cancel = useCancelOrder();

  function handleCancel() {
    if (!window.confirm(t('cancelConfirm'))) return;
    cancel.mutate(orderId, {
      onSuccess: () => {
        toast.success(t('cancelled'));
        router.push('/orders');
      },
      onError: () => toast.error(t('cancelError')),
    });
  }

  if (order.isPending) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Skeleton className="h-8 w-48" />
      </main>
    );
  }

  if (order.isError) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-8">
        <p className="text-destructive">{t('error')}</p>
        <Button asChild variant="outline">
          <Link href="/orders">{t('back')}</Link>
        </Button>
      </main>
    );
  }

  const o = order.data;
  const addr = o.shippingAddress;
  // One review block per DISTINCT product in a delivered order (the backend allows
  // one review per product, not per line) — any item of that product is valid proof.
  const reviewableProducts =
    o.status === 'DELIVERED'
      ? Array.from(new Map(o.items.map((it) => [it.productId, it])).values())
      : [];
  // Chronological order for the timeline; the last entry is the current status.
  const history = [...o.statusHistory].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const addrLine = [
    addr.line1,
    addr.line2,
    addr.ward,
    addr.district,
    addr.city,
    addr.country,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">#{o.id.slice(-8)}</h1>
        <OrderStatusBadge status={o.status} />
      </div>
      <p className="text-muted-foreground text-sm">
        {t('orderDate')}: {formatDate(o.createdAt, locale)}
      </p>

      {/* Pay or cancel a stuck PENDING_PAYMENT order — payment lives on /pay */}
      {o.status === 'PENDING_PAYMENT' ? (
        <div className="flex gap-3">
          <Button asChild>
            <Link href={`/orders/${o.id}/pay`}>{t('completePayment')}</Link>
          </Button>
          <Button
            variant="ghost"
            disabled={cancel.isPending}
            onClick={handleCancel}
          >
            {tPay('cancelOrder')}
          </Button>
        </div>
      ) : null}

      {/* Shipping address (snapshot) */}
      <section className="flex flex-col gap-1">
        <h2 className="font-medium">{t('shippingAddress')}</h2>
        <p className="text-muted-foreground text-sm">
          {addr.fullName} · {addr.phone}
        </p>
        <p className="text-muted-foreground text-sm">{addrLine}</p>
      </section>

      {/* Line items (names from the order snapshot, not live catalog) */}
      <section className="flex flex-col">
        {o.items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between gap-2 border-b py-2 text-sm"
          >
            <div>
              <div>
                {locale === 'vi' ? item.productNameVi : item.productNameEn}
              </div>
              <div className="text-muted-foreground text-xs">
                {item.size}/{item.color} ·{' '}
                {formatPriceCents(item.unitPriceCents)} × {item.quantity}
              </div>
            </div>
            <span className="font-medium">
              {formatPriceCents(item.unitPriceCents * item.quantity)}
            </span>
          </div>
        ))}
        <div className="mt-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span>{t('subtotal')}</span>
            <span>{formatPriceCents(o.subtotalCents)}</span>
          </div>
          {o.discountCents > 0 ? (
            <div className="flex justify-between">
              <span>{t('discount')}</span>
              <span>-{formatPriceCents(o.discountCents)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-semibold">
            <span>{t('total')}</span>
            <span>{formatPriceCents(o.totalCents)}</span>
          </div>
        </div>
      </section>

      {/* Status timeline */}
      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t('timeline')}</h2>
        <ol className="flex flex-col gap-3">
          {history.map((h, i) => {
            const isCurrent = i === history.length - 1;
            return (
              <li
                key={h.id}
                className={cn(
                  'flex flex-col gap-1 border-l-2 pl-3',
                  isCurrent ? 'border-primary' : 'border-muted',
                )}
              >
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={h.status} />
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(h.createdAt, locale)}
                  </span>
                </div>
                {h.note ? (
                  <span className={cn('text-sm', isCurrent && 'font-medium')}>
                    {h.note}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Reviews — a delivered order unlocks one review per purchased product */}
      {reviewableProducts.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-medium">{tReview('title')}</h2>
          {reviewableProducts.map((item) => (
            <OrderItemReview
              key={item.productId}
              orderItemId={item.id}
              productId={item.productId}
              productName={
                locale === 'vi' ? item.productNameVi : item.productNameEn
              }
              userId={user?.id}
            />
          ))}
        </section>
      ) : null}

      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/orders">{t('back')}</Link>
      </Button>
    </main>
  );
}

type OrderItemReviewProps = {
  orderItemId: string;
  productId: string;
  productName: string;
  userId: string | undefined;
};

// A single product's review block on the order page: shows the user's existing
// review (with an Edit toggle) or a create form. "Already reviewed" is detected by
// matching the user's id against the product's public review list (the order
// payload carries no review back-reference).
function OrderItemReview({
  orderItemId,
  productId,
  productName,
  userId,
}: OrderItemReviewProps) {
  const tReview = useTranslations('reviews');
  const reviews = useProductReviews(productId);
  const create = useCreateReview();
  const update = useUpdateReview();

  const mine = reviews.data?.items.find((r) => r.userId === userId);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');

  const pending = create.isPending || update.isPending;
  const showForm = !mine || editing;

  function startEdit() {
    setRating(mine?.rating ?? 0);
    setBody(mine?.body ?? '');
    setEditing(true);
  }

  function handleError(err: unknown) {
    if (err instanceof ApiError && err.status === 409) {
      toast.error(tReview('alreadyReviewed'));
    } else {
      toast.error(tReview('error'));
    }
  }

  function submit() {
    if (rating < 1) return;
    const text = body.trim();
    if (mine) {
      update.mutate(
        { id: mine.id, body: { rating, body: text } },
        {
          onSuccess: () => {
            toast.success(tReview('updated'));
            setEditing(false);
          },
          onError: handleError,
        },
      );
    } else {
      create.mutate(
        { orderItemId, rating, ...(text ? { body: text } : {}) },
        {
          onSuccess: () => toast.success(tReview('submitted')),
          onError: handleError,
        },
      );
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="text-sm font-medium">{productName}</div>

      {reviews.isPending ? (
        <Skeleton className="h-6 w-32" />
      ) : showForm ? (
        <div className="flex flex-col items-start gap-2">
          <StarRating
            value={rating}
            onChange={setRating}
            label={tReview('rating')}
          />
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            placeholder={tReview('commentPlaceholder')}
            className="w-full"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={rating < 1 || pending}>
              {tReview('submit')}
            </Button>
            {editing ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={pending}
              >
                {tReview('cancel')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          <StarRating value={mine.rating} readOnly />
          {mine.body ? <p className="text-sm">{mine.body}</p> : null}
          <Button size="sm" variant="outline" onClick={startEdit}>
            {tReview('editReview')}
          </Button>
        </div>
      )}
    </div>
  );
}
