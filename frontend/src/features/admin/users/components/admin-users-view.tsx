'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Copy } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { useAdminUser } from '@/features/admin/users/hooks/use-users';
import { OrderStatusBadge } from '@/components/order-status-badge';
import { OrderDetailDialog } from '@/features/admin/components/order-detail-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { formatPriceCents } from '@/lib/money';
import { formatDate } from '@/lib/datetime';
import type { OrderStatus } from '@/features/order/api/orders';
import type { AdminUserDetail } from '@/features/admin/users/api/users';

// Order statuses in fulfillment order, for the per-status breakdown (only non-zero
// counts are shown). OrderStatus is a generated union with no runtime enum.
const STATUSES: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

export function AdminUsersView({ userId }: { userId: string }) {
  const t = useTranslations('admin');
  const { isPending, isError, error, data } = useAdminUser(userId);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-destructive text-sm">
          {notFound ? t('userNotFound') : t('userError')}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="size-4" />
            {t('back')}
          </Link>
        </Button>
      </div>
    );
  }

  return <UserDetail user={data} />;
}

function UserDetail({ user }: { user: AdminUserDetail }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const { profile, addresses, stats, recentOrders } = user;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-2xl font-semibold">{t('userDetail')}</h1>
          <CopyableId
            id={user.id}
            label={t('userId')}
            copiedLabel={t('copied')}
          />
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="size-4" />
            {t('back')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Basics */}
        <Card>
          <CardHeader>
            <CardTitle>{user.name ?? user.email}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            <Field label={t('email')} value={user.email} />
            <Field label={t('name')} value={user.name ?? '—'} />
            <Field label={t('role')} value={user.role} />
            <Field
              label={t('birthday')}
              value={user.birthday ? formatDate(user.birthday, locale) : '—'}
            />
            <Field label={t('joined')} value={formatDate(user.createdAt, locale)} />
          </CardContent>
        </Card>

        {/* Order stats */}
        <Card>
          <CardHeader>
            <CardTitle>{t('orderStats')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex gap-6">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">
                  {t('totalOrders')}
                </span>
                <span className="text-xl font-semibold">
                  {stats.totalOrders}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">
                  {t('totalSpent')}
                </span>
                <span className="text-xl font-semibold">
                  {formatPriceCents(stats.totalSpentCents)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">
                {t('byStatus')}
              </span>
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter((s) => stats.byStatus[s] > 0).map((s) => (
                  <span key={s} className="inline-flex items-center gap-1">
                    <OrderStatusBadge status={s} />
                    <span className="text-muted-foreground text-xs">
                      {stats.byStatus[s]}
                    </span>
                  </span>
                ))}
                {stats.totalOrders === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile (only when present) */}
        {profile ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('profile')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <Field
                label={t('height')}
                value={profile.heightCm != null ? String(profile.heightCm) : '—'}
              />
              <Field
                label={t('weight')}
                value={profile.weightKg != null ? String(profile.weightKg) : '—'}
              />
              {profile.measurements &&
              typeof profile.measurements === 'object' ? (
                <Field
                  label={t('measurements')}
                  value={Object.entries(
                    profile.measurements as Record<string, unknown>,
                  )
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(' · ')}
                />
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Address book */}
        <Card>
          <CardHeader>
            <CardTitle>{t('addresses')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {addresses.length === 0 ? (
              <span className="text-muted-foreground">{t('noAddresses')}</span>
            ) : (
              addresses.map((a) => (
                <div key={a.id} className="flex flex-col">
                  <span className="flex items-center gap-2">
                    {a.fullName} · {a.phone}
                    {a.isDefault ? (
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                        {t('defaultAddress')}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">
                    {[a.line1, a.line2, a.ward, a.district, a.city, a.country]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent orders */}
      <Card>
        <CardHeader>
          <CardTitle>{t('recentOrders')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <span className="text-muted-foreground text-sm">
              {t('noRecentOrders')}
            </span>
          ) : (
            <div className="flex flex-col">
              {recentOrders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOpenOrderId(o.id)}
                  className="hover:bg-muted/60 flex items-center justify-between gap-2 border-b py-2 text-left text-sm last:border-b-0"
                >
                  <span className="font-mono">#{o.id.slice(-8)}</span>
                  <OrderStatusBadge status={o.status} />
                  <span className="text-muted-foreground">
                    {formatDate(o.createdAt, locale)}
                  </span>
                  <span className="font-medium">
                    {formatPriceCents(o.totalCents)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailDialog
        orderId={openOrderId}
        onOpenChange={(open) => {
          if (!open) setOpenOrderId(null);
        }}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

// The user id, click-to-copy (for admins referencing a user, e.g. voucher grants).
function CopyableId({
  id,
  label,
  copiedLabel,
}: {
  id: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (insecure context) — silently ignore.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={label}
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs"
    >
      <span className="font-mono">{id}</span>
      <Copy className="size-3" />
      {copied ? <span>{copiedLabel}</span> : null}
    </button>
  );
}
