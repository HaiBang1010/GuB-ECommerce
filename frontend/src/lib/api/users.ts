import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

// Full admin view of one customer: identity + profile + addresses + order stats +
// recent orders (composed server-side via services, no cross-module JOIN).
export type AdminUserDetail =
  components['schemas']['AdminUserDetailResponseDto'];
export type OrderStats = components['schemas']['OrderStatsDto'];
export type OrderStatusCounts = components['schemas']['OrderStatusCountsDto'];

// GET /admin/users/:id — one customer's full detail. ADMIN-only on the backend
// (RoleGuard); 404 when the user does not exist.
export function getAdminUser(
  id: string,
  signal?: AbortSignal,
): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`, {
    signal,
  });
}
