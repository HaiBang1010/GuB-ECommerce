'use client';

import { Bell } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/features/notification/hooks/use-notifications';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDate } from '@/lib/datetime';
import type { NotificationItem } from '@/features/notification/api/notifications';

// Map a notification `type` to an i18n key — the text is rendered from structured
// data (type + payload), never read as a stored vi/en string from the DB.
const TYPE_KEY: Record<string, string> = {
  ORDER_PAID: 'orderPaid',
  ORDER_SHIPPED: 'orderShipped',
  ORDER_DELIVERED: 'orderDelivered',
};

export function NotificationBell() {
  const t = useTranslations('notification');
  const locale = useLocale();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  function label(n: NotificationItem): string {
    const key = TYPE_KEY[n.type];
    const orderId = n.payload?.orderId ? n.payload.orderId.slice(-8) : '';
    return key ? t(key, { orderId }) : n.type;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('title')}
          className="relative"
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none">
              {unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <DropdownMenuLabel className="p-0">{t('title')}</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              className="text-muted-foreground text-xs hover:underline"
            >
              {t('markAllRead')}
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="text-muted-foreground px-2 py-4 text-center text-sm">
            {t('noNotifications')}
          </p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              asChild
              onSelect={() => {
                if (!n.readAt) markRead.mutate(n.id);
              }}
            >
              <Link
                href={
                  n.payload?.orderId ? `/orders/${n.payload.orderId}` : '/orders'
                }
                className="flex flex-col items-start gap-0.5"
              >
                <span className="flex items-center gap-1.5">
                  {!n.readAt ? (
                    <span
                      className="bg-primary size-1.5 shrink-0 rounded-full"
                      aria-hidden
                    />
                  ) : null}
                  <span className={n.readAt ? 'text-muted-foreground' : 'font-medium'}>
                    {label(n)}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(n.createdAt, locale)}
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
