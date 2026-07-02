'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import {
  useAnalyticsSummary,
  useLowStock,
  useSalesByCategory,
  useTopProducts,
  useTopSpenders,
  useVoucherUsage,
} from '@/features/admin/analytics/hooks/use-analytics';
import type { DateRange } from '@/features/admin/analytics/api/analytics';
import { useDebounce } from '@/features/admin/hooks/use-debounce';
import {
  NamedBarChart,
  NewUsersChart,
  RevenueChart,
} from '@/features/admin/analytics/components/analytics-charts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPriceCents } from '@/lib/money';
import { cn } from '@/lib/utils';

// Local YYYY-MM-DD (matches what <input type="date"> shows the user). The backend
// snaps these to UTC day edges.
function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return ymd(d);
}

const PRESETS = [7, 30, 90] as const;

export function AnalyticsView() {
  const t = useTranslations('analytics');
  const locale = useLocale();

  const [preset, setPreset] = useState<number | null>(30);
  const [from, setFrom] = useState(() => daysAgo(29));
  const [to, setTo] = useState(() => ymd(new Date()));
  const [thresholdInput, setThresholdInput] = useState('5');

  const range: DateRange = useMemo(() => ({ from, to }), [from, to]);
  const threshold = Math.max(0, Number(useDebounce(thresholdInput, 400)) || 0);

  const summary = useAnalyticsSummary(range);
  const topProducts = useTopProducts(range);
  const topSpenders = useTopSpenders(range);
  const salesByCategory = useSalesByCategory(range);
  const voucherUsage = useVoucherUsage(range);
  const lowStock = useLowStock(threshold);

  function applyPreset(days: number) {
    setPreset(days);
    setFrom(daysAgo(days - 1));
    setTo(ymd(new Date()));
  }
  function editFrom(v: string) {
    setPreset(null);
    setFrom(v);
  }
  function editTo(v: string) {
    setPreset(null);
    setTo(v);
  }

  const kpi = summary.data?.kpi;
  const localeName = (r: { nameVi: string; nameEn: string }) =>
    locale === 'vi' ? r.nameVi : r.nameEn;

  return (
    <div className="flex flex-col gap-4">
      {/* Header + date-range controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {PRESETS.map((days) => (
              <Button
                key={days}
                size="sm"
                variant={preset === days ? 'default' : 'outline'}
                onClick={() => applyPreset(days)}
              >
                {t(`range.last${days}`)}
              </Button>
            ))}
          </div>
          <Input
            type="date"
            aria-label={t('range.from')}
            value={from}
            max={to}
            onChange={(e) => editFrom(e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="date"
            aria-label={t('range.to')}
            value={to}
            min={from}
            onChange={(e) => editTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label={t('kpi.netRevenue')}
          value={kpi ? formatPriceCents(kpi.netRevenueCents) : undefined}
          loading={summary.isPending}
        />
        <KpiCard
          label={t('kpi.orders')}
          value={kpi ? String(kpi.orderCount) : undefined}
          loading={summary.isPending}
        />
        <KpiCard
          label={t('kpi.aov')}
          value={kpi ? formatPriceCents(kpi.aovCents) : undefined}
          loading={summary.isPending}
        />
        <KpiCard
          label={t('kpi.unitsSold')}
          value={kpi ? String(kpi.unitsSold) : undefined}
          loading={summary.isPending}
        />
        <KpiCard
          label={t('kpi.newUsers')}
          value={kpi ? String(kpi.newUsers) : undefined}
          loading={summary.isPending}
        />
      </div>

      {/* Revenue over time */}
      <Panel
        title={t('revenueTitle')}
        isPending={summary.isPending}
        isError={summary.isError}
        isEmpty={!summary.data?.revenue.length}
        empty={t('empty')}
        error={t('error')}
      >
        {summary.data ? <RevenueChart data={summary.data.revenue} /> : null}
      </Panel>

      {/* New users + orders by status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t('newUsersTitle')}
          isPending={summary.isPending}
          isError={summary.isError}
          isEmpty={!summary.data?.newUsers.length}
          empty={t('empty')}
          error={t('error')}
        >
          {summary.data ? <NewUsersChart data={summary.data.newUsers} /> : null}
        </Panel>
        <Panel
          title={t('ordersByStatusTitle')}
          isPending={summary.isPending}
          isError={summary.isError}
          isEmpty={!summary.data?.ordersByStatus.length}
          empty={t('empty')}
          error={t('error')}
        >
          {summary.data ? (
            <NamedBarChart
              data={summary.data.ordersByStatus.map((s) => ({
                name: t(`status.${s.status}`),
                value: s.count,
              }))}
            />
          ) : null}
        </Panel>
      </div>

      {/* Top products + top spenders */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t('topProductsTitle')}
          isPending={topProducts.isPending}
          isError={topProducts.isError}
          isEmpty={!topProducts.data?.length}
          empty={t('empty')}
          error={t('error')}
        >
          <SimpleTable
            head={[t('table.product'), t('table.units'), t('table.revenue')]}
            rows={(topProducts.data ?? []).map((p) => [
              localeName(p),
              String(p.unitsSold),
              formatPriceCents(p.revenueCents),
            ])}
            numericFrom={1}
          />
        </Panel>
        <Panel
          title={t('topSpendersTitle')}
          isPending={topSpenders.isPending}
          isError={topSpenders.isError}
          isEmpty={!topSpenders.data?.length}
          empty={t('empty')}
          error={t('error')}
        >
          <SimpleTable
            head={[t('table.customer'), t('table.orders'), t('table.spent')]}
            rows={(topSpenders.data ?? []).map((s) => [
              s.name || s.email || `${s.userId.slice(0, 8)}…`,
              String(s.orderCount),
              formatPriceCents(s.totalSpentCents),
            ])}
            numericFrom={1}
          />
        </Panel>
      </div>

      {/* Sales by category + voucher usage */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t('salesByCategoryTitle')}
          isPending={salesByCategory.isPending}
          isError={salesByCategory.isError}
          isEmpty={!salesByCategory.data?.length}
          empty={t('empty')}
          error={t('error')}
        >
          {salesByCategory.data ? (
            <NamedBarChart
              money
              data={salesByCategory.data.map((c) => ({
                name: localeName(c),
                value: c.revenueCents,
              }))}
            />
          ) : null}
        </Panel>
        <Panel
          title={t('voucherUsageTitle')}
          isPending={voucherUsage.isPending}
          isError={voucherUsage.isError}
          isEmpty={!voucherUsage.data?.length}
          empty={t('empty')}
          error={t('error')}
        >
          <SimpleTable
            head={[t('table.code'), t('table.orders'), t('table.discount')]}
            rows={(voucherUsage.data ?? []).map((v) => [
              v.voucherCode,
              String(v.orderCount),
              formatPriceCents(v.discountCents),
            ])}
            numericFrom={1}
          />
        </Panel>
      </div>

      {/* Low stock */}
      <Panel
        title={t('lowStockTitle')}
        isPending={lowStock.isPending}
        isError={lowStock.isError}
        isEmpty={!lowStock.data?.length}
        empty={t('lowStockEmpty')}
        error={t('error')}
        action={
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            {t('lowStockThreshold')}
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              className="w-20"
            />
          </label>
        }
      >
        <SimpleTable
          head={[
            t('table.product'),
            t('table.sku'),
            t('table.variant'),
            t('table.stock'),
          ]}
          rows={(lowStock.data ?? []).map((v) => [
            localeName(v),
            v.sku,
            `${v.size} / ${v.color}`,
            String(v.stockQty),
          ])}
          numericFrom={3}
        />
      </Panel>
    </div>
  );
}

function KpiCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | undefined;
  loading: boolean;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs">{label}</span>
        {loading || value === undefined ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <span className="text-2xl font-semibold">{value}</span>
        )}
      </CardContent>
    </Card>
  );
}

// A section card that owns the loading / error / empty / content states so each
// chart or table doesn't repeat them.
function Panel({
  title,
  action,
  isPending,
  isError,
  isEmpty,
  empty,
  error,
  children,
}: {
  title: string;
  action?: ReactNode;
  isPending: boolean;
  isError: boolean;
  isEmpty: boolean;
  empty: string;
  error: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-56 w-full" />
        ) : isError ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : isEmpty ? (
          <p className="text-muted-foreground text-sm">{empty}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

// A minimal read-only table. Columns at index >= numericFrom are right-aligned +
// tabular (numbers/money).
function SimpleTable({
  head,
  rows,
  numericFrom = head.length,
}: {
  head: string[];
  rows: string[][];
  numericFrom?: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left">
            {head.map((h, i) => (
              <th
                key={i}
                className={cn(
                  'py-2 pr-3 font-medium',
                  i >= numericFrom && 'text-right',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b last:border-0">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    'py-2 pr-3',
                    ci >= numericFrom && 'text-right tabular-nums',
                    ci === 0 && 'font-medium',
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
