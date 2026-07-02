import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

// Types come straight from the committed OpenAPI schema (regenerated via
// `npm run gen:api`). The backend is the single source of truth for the shapes.
export type AnalyticsSummary =
  components['schemas']['AnalyticsSummaryResponseDto'];
export type TopSpender = components['schemas']['TopSpenderDto'];
export type TopProduct = components['schemas']['TopProductDto'];
export type SalesByCategory = components['schemas']['SalesByCategoryDto'];
export type VoucherUsage = components['schemas']['VoucherUsageDto'];
export type LowStockVariant = components['schemas']['LowStockVariantDto'];

// A UTC-day window, both YYYY-MM-DD strings (the backend snaps them to day edges).
export type DateRange = { from: string; to: string };

function withRange(
  path: string,
  range: DateRange,
  extra?: Record<string, string | number>,
): string {
  const qs = new URLSearchParams();
  if (range.from) qs.set('from', range.from);
  if (range.to) qs.set('to', range.to);
  for (const [k, v] of Object.entries(extra ?? {})) qs.set(k, String(v));
  const q = qs.toString();
  return `${path}${q ? `?${q}` : ''}`;
}

// GET /admin/analytics/summary — KPIs + revenue/new-users series + orders-by-status.
export function getAnalyticsSummary(
  range: DateRange,
  signal?: AbortSignal,
): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>(withRange('/admin/analytics/summary', range), {
    signal,
  });
}

// GET /admin/analytics/top-spenders — highest net-paid customers.
export function getTopSpenders(
  range: DateRange,
  limit: number,
  signal?: AbortSignal,
): Promise<TopSpender[]> {
  return apiFetch<TopSpender[]>(
    withRange('/admin/analytics/top-spenders', range, { limit }),
    { signal },
  );
}

// GET /admin/analytics/top-products — best sellers by revenue.
export function getTopProducts(
  range: DateRange,
  limit: number,
  signal?: AbortSignal,
): Promise<TopProduct[]> {
  return apiFetch<TopProduct[]>(
    withRange('/admin/analytics/top-products', range, { limit }),
    { signal },
  );
}

// GET /admin/analytics/sales-by-category — revenue rolled up per category.
export function getSalesByCategory(
  range: DateRange,
  signal?: AbortSignal,
): Promise<SalesByCategory[]> {
  return apiFetch<SalesByCategory[]>(
    withRange('/admin/analytics/sales-by-category', range),
    { signal },
  );
}

// GET /admin/analytics/voucher-usage — redemptions + total discount per code.
export function getVoucherUsage(
  range: DateRange,
  signal?: AbortSignal,
): Promise<VoucherUsage[]> {
  return apiFetch<VoucherUsage[]>(
    withRange('/admin/analytics/voucher-usage', range),
    { signal },
  );
}

// GET /admin/analytics/low-stock — active variants at/below a stock threshold.
// Time-independent (a stock snapshot), so it takes only the threshold.
export function getLowStock(
  threshold: number,
  signal?: AbortSignal,
): Promise<LowStockVariant[]> {
  const qs = new URLSearchParams({ threshold: String(threshold) });
  return apiFetch<LowStockVariant[]>(`/admin/analytics/low-stock?${qs.toString()}`, {
    signal,
  });
}
