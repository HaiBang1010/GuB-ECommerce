import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  getAnalyticsSummary,
  getLowStock,
  getSalesByCategory,
  getTopProducts,
  getTopSpenders,
  getVoucherUsage,
  type DateRange,
} from '@/features/admin/analytics/api/analytics';

// All analytics reads are gated to a logged-in user (the backend RoleGuard is the
// real gate); keepPreviousData avoids a flash when the date range / limit changes.
function useAuthGate() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return !authLoading && !!user;
}

export function useAnalyticsSummary(range: DateRange) {
  const enabled = useAuthGate();
  return useQuery({
    queryKey: ['admin', 'analytics', 'summary', range],
    queryFn: ({ signal }) => getAnalyticsSummary(range, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useTopSpenders(range: DateRange, limit = 10) {
  const enabled = useAuthGate();
  return useQuery({
    queryKey: ['admin', 'analytics', 'top-spenders', range, limit],
    queryFn: ({ signal }) => getTopSpenders(range, limit, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useTopProducts(range: DateRange, limit = 10) {
  const enabled = useAuthGate();
  return useQuery({
    queryKey: ['admin', 'analytics', 'top-products', range, limit],
    queryFn: ({ signal }) => getTopProducts(range, limit, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSalesByCategory(range: DateRange) {
  const enabled = useAuthGate();
  return useQuery({
    queryKey: ['admin', 'analytics', 'sales-by-category', range],
    queryFn: ({ signal }) => getSalesByCategory(range, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useVoucherUsage(range: DateRange) {
  const enabled = useAuthGate();
  return useQuery({
    queryKey: ['admin', 'analytics', 'voucher-usage', range],
    queryFn: ({ signal }) => getVoucherUsage(range, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useLowStock(threshold = 5) {
  const enabled = useAuthGate();
  return useQuery({
    queryKey: ['admin', 'analytics', 'low-stock', threshold],
    queryFn: ({ signal }) => getLowStock(threshold, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}
