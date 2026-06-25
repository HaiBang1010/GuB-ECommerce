'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useAdminOrders, useAdminUpdateOrderStatus } from '@/hooks/use-orders';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { formatPriceCents } from '@/lib/money';
import type { OrderStatus } from '@/lib/api/orders';

// The single admin-driven fulfillment chain. The backend ADMIN_TRANSITIONS is
// authoritative — this only decides which advance button to show; an illegal step
// is still rejected server-side.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PAID: 'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
};

export function AdminOrdersView() {
  const t = useTranslations('admin');
  const tStatus = useTranslations('order.status');
  const { isPending, isError, data } = useAdminOrders();
  const advance = useAdminUpdateOrderStatus();

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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('orders')}</h1>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t('error')}</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noOrders')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 pr-4 font-medium">{t('orderId')}</th>
                <th className="py-2 pr-4 font-medium">{t('user')}</th>
                <th className="py-2 pr-4 font-medium">{t('statusColumn')}</th>
                <th className="py-2 pr-4 font-medium">{t('total')}</th>
                <th className="py-2 font-medium">{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => {
                const next = NEXT_STATUS[o.status];
                return (
                  <tr key={o.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-mono">#{o.id.slice(-8)}</td>
                    <td className="text-muted-foreground py-2 pr-4 font-mono">
                      {o.userId.slice(-8)}
                    </td>
                    <td className="py-2 pr-4">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="py-2 pr-4">
                      {formatPriceCents(o.totalCents)}
                    </td>
                    <td className="py-2">
                      {next ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={advance.isPending}
                          onClick={() => handleAdvance(o.id, next)}
                        >
                          {t('advanceTo', { status: tStatus(next) })}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
