import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Order = components['schemas']['OrderResponseDto'];
// Admin list row = order + enriched customer summary (email/name).
export type AdminOrder = components['schemas']['OrderAdminResponseDto'];
// One paginated page of admin orders.
export type PaginatedOrders =
  components['schemas']['PaginatedOrdersResponseDto'];
export type OrderItem = components['schemas']['OrderItemDto'];
export type OrderStatusHistory =
  components['schemas']['OrderStatusHistoryDto'];
export type OrderStatus = Order['status'];
export type PaymentIntentResult =
  components['schemas']['PaymentIntentResponseDto'];
export type OutOfStockError = components['schemas']['OutOfStockErrorDto'];
export type UpdateOrderStatusBody =
  components['schemas']['UpdateOrderStatusDto'];

// Narrow an ApiError body (status 409) to the structured out-of-stock payload so
// the checkout view can tell a stock conflict apart from a real payment failure.
export function isOutOfStockError(body: unknown): body is OutOfStockError {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { code?: unknown }).code === 'OUT_OF_STOCK' &&
    Array.isArray((body as { items?: unknown }).items)
  );
}

// POST /orders — body is just { addressId }; items come from the user's server
// cart, the address is snapshotted. Returns the order (status PENDING_PAYMENT).
export function createOrder(addressId: string): Promise<Order> {
  return apiFetch<Order>('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addressId }),
  });
}

// POST /payments/intent — create/reuse the Stripe PaymentIntent for an order.
export function createPaymentIntent(
  orderId: string,
): Promise<PaymentIntentResult> {
  return apiFetch<PaymentIntentResult>('/payments/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
}

// GET /orders/:id — one of the user's orders (includes items + statusHistory).
export function getOrder(id: string, signal?: AbortSignal): Promise<Order> {
  return apiFetch<Order>(`/orders/${encodeURIComponent(id)}`, { signal });
}

// POST /orders/:id/cancel — cancel an unpaid order; releases stock. Owner-only,
// idempotent on an already-cancelled order, 409 if the order is no longer PENDING.
export function cancelOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}

// GET /orders — the current user's order history (bare array).
export function getMyOrders(signal?: AbortSignal): Promise<Order[]> {
  return apiFetch<Order[]>('/orders', { signal });
}

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
