'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import type { OrderStatus } from '@/lib/api/orders';

// Light-only status colors (no dark variants).
const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
  REFUNDED: 'bg-rose-100 text-rose-800',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations('order.status');
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
      )}
    >
      {t(status)}
    </span>
  );
}
