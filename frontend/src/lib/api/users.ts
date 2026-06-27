import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

// Full admin view of one customer: identity + profile + addresses + order stats +
// recent orders (composed server-side via services, no cross-module JOIN).
export type AdminUserDetail =
  components['schemas']['AdminUserDetailResponseDto'];
export type OrderStats = components['schemas']['OrderStatsDto'];
export type OrderStatusCounts = components['schemas']['OrderStatusCountsDto'];
// One row of the admin users list.
export type AdminUserListItem =
  components['schemas']['AdminUserListItemDto'];
export type PaginatedAdminUsers =
  components['schemas']['PaginatedAdminUsersResponseDto'];

// GET /admin/users — a paginated page of customers, with optional name/email
// search. ADMIN-only on the backend (RoleGuard).
export function getAdminUsers(
  params: { search?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
): Promise<PaginatedAdminUsers> {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return apiFetch<PaginatedAdminUsers>(`/admin/users${q ? `?${q}` : ''}`, {
    signal,
  });
}

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
