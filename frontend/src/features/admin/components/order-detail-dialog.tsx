'use client';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  useAdminOrderDetail,
  useAdminUpdateOrderStatus,
  useRefundOrder,
} from '@/features/admin/orders/hooks/use-admin-orders';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { formatPriceCents } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/datetime';
import type { AdminOrder } from '@/features/admin/orders/api/orders';
import type { OrderStatus } from '@/features/order/api/orders';

// The admin-driven fulfillment chain — which advance button to show. The backend
// ADMIN_TRANSITIONS is authoritative; an illegal step is rejected server-side.
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PAID: 'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
};

// Statuses an admin may full-refund (mirrors the backend REFUNDABLE_STATUSES). The
// backend re-validates + 409s otherwise; this only decides whether to show the button.
const REFUNDABLE: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'PAID',
  'PROCESSING',
  'SHIPPED',
]);

// Admin order-detail dialog. Open iff `orderId` is non-null; fetches full detail by
// id (seeded by the list row so it paints instantly). Reused from the orders table
// and the user-detail page's recent orders.
export function OrderDetailDialog({
  orderId,
  initialOrder,
  onOpenChange,
}: {
  orderId: string | null;
  initialOrder?: AdminOrder;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('admin');
  const tStatus = useTranslations('order.status');
  const tOrder = useTranslations('order');
  const locale = useLocale();
  const { isPending, isError, data } = useAdminOrderDetail(
    orderId,
    initialOrder,
  );
  const advance = useAdminUpdateOrderStatus();
  const refund = useRefundOrder();

  function handleAdvance(id: string, next: OrderStatus) {
    advance.mutate(
      { id, body: { status: next } },
      {
        onSuccess: () => toast.success(t('statusUpdated')),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t('updateError')),
      },
    );
  }

  function handleRefund(id: string) {
    if (!window.confirm(t('refundConfirm'))) return;
    refund.mutate(id, {
      onSuccess: () => toast.success(t('refundSuccess')),
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : t('refundError')),
    });
  }

  return (
    <Dialog open={orderId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {isPending || !data ? (
          isError ? (
            <p className="text-destructive text-sm">{t('error')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          )
        ) : (
          <OrderDetailBody
            order={data}
            locale={locale}
            t={t}
            tStatus={tStatus}
            tOrder={tOrder}
            advancing={advance.isPending}
            refunding={refund.isPending}
            onAdvance={handleAdvance}
            onRefund={handleRefund}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrderDetailBody({
  order,
  locale,
  t,
  tStatus,
  tOrder,
  advancing,
  refunding,
  onAdvance,
  onRefund,
}: {
  order: AdminOrder;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  tStatus: ReturnType<typeof useTranslations>;
  tOrder: ReturnType<typeof useTranslations>;
  advancing: boolean;
  refunding: boolean;
  onAdvance: (id: string, next: OrderStatus) => void;
  onRefund: (id: string) => void;
}) {
  const addr = order.shippingAddress;
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
  const history = [...order.statusHistory].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const next = NEXT_STATUS[order.status];
  const canRefund = REFUNDABLE.has(order.status);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-mono">
          #{order.id.slice(-8)}
          <OrderStatusBadge status={order.status} />
        </DialogTitle>
        <p className="text-muted-foreground text-sm">
          {formatDate(order.createdAt, locale)}
        </p>
      </DialogHeader>

      {/* Customer (enriched server-side; null if the user is gone) */}
      <section className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">{t('customer')}</span>
        {order.customer ? (
          <>
            {order.customer.name ? <span>{order.customer.name}</span> : null}
            <span className="text-muted-foreground">
              {order.customer.email}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{order.userId}</span>
        )}
      </section>

      {/* Shipping address snapshot */}
      <section className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">{tOrder('shippingAddress')}</span>
        <span className="text-muted-foreground">
          {addr.fullName} · {addr.phone}
        </span>
        <span className="text-muted-foreground">{addrLine}</span>
      </section>

      {/* Line items (names from the order snapshot) */}
      <section className="flex flex-col">
        <span className="mb-1 text-sm font-medium">{t('items')}</span>
        {order.items.map((item) => (
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
            <span>{tOrder('subtotal')}</span>
            <span>{formatPriceCents(order.subtotalCents)}</span>
          </div>
          {order.discountCents > 0 ? (
            <div className="flex justify-between">
              <span>{tOrder('discount')}</span>
              <span>-{formatPriceCents(order.discountCents)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-semibold">
            <span>{t('total')}</span>
            <span>{formatPriceCents(order.totalCents)}</span>
          </div>
        </div>
      </section>

      {/* Status timeline */}
      <section className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('timeline')}</span>
        <ol className="flex flex-col gap-2">
          {history.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 text-sm">
              <OrderStatusBadge status={h.status} />
              <span className="text-muted-foreground text-xs">
                {formatDateTime(h.createdAt, locale)}
              </span>
              {h.note ? <span className="text-xs">— {h.note}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      {/* Refund (destructive) + advance fulfillment, when applicable */}
      {canRefund || next ? (
        <div className="flex justify-end gap-2">
          {canRefund ? (
            <Button
              size="sm"
              variant="destructive"
              disabled={refunding}
              onClick={() => onRefund(order.id)}
            >
              {t('refund')}
            </Button>
          ) : null}
          {next ? (
            <Button
              size="sm"
              disabled={advancing}
              onClick={() => onAdvance(order.id, next)}
            >
              {t('advanceTo', { status: tStatus(next) })}
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
