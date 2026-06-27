import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';
import type { Order, OrderStatus } from '@/features/order/api/orders';

// Admin list row = order + enriched customer summary (email/name).
export type AdminOrder = components['schemas']['OrderAdminResponseDto'];
// One paginated page of admin orders.
export type PaginatedOrders =
  components['schemas']['PaginatedOrdersResponseDto'];
export type UpdateOrderStatusBody =
  components['schemas']['UpdateOrderStatusDto'];

// GET /admin/orders — a paginated page of orders, with optional multi-status
// filter + unified search (order id / customer name / email), each row enriched
// with customer info. ADMIN-only on the backend (RoleGuard). Statuses repeat as
// ?status=A&status=B; pagination via ?page&?pageSize.
export function getAdminOrders(
  params: {
    statuses?: OrderStatus[];
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
  signal?: AbortSignal,
): Promise<PaginatedOrders> {
  const qs = new URLSearchParams();
  params.statuses?.forEach((s) => qs.append('status', s));
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return apiFetch<PaginatedOrders>(`/admin/orders${q ? `?${q}` : ''}`, {
    signal,
  });
}

// GET /admin/orders/:id — one order with full detail + customer info, for the
// admin order-detail dialog. ADMIN-only on the backend (RoleGuard).
export function getAdminOrder(
  id: string,
  signal?: AbortSignal,
): Promise<AdminOrder> {
  return apiFetch<AdminOrder>(`/admin/orders/${encodeURIComponent(id)}`, {
    signal,
  });
}

// POST /admin/orders/:id/status — advance fulfillment (PAID→PROCESSING→SHIPPED→
// DELIVERED). The backend enforces the legal transition; an illegal step 400s.
export function adminUpdateOrderStatus(
  id: string,
  body: UpdateOrderStatusBody,
): Promise<Order> {
  return apiFetch<Order>(`/admin/orders/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
