import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Order = components['schemas']['OrderResponseDto'];
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

// GET /admin/orders — every order (optionally filtered by status). ADMIN-only on
// the backend (RoleGuard). Payload exposes only userId, not customer email.
export function getAdminOrders(
  status?: OrderStatus,
  signal?: AbortSignal,
): Promise<Order[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<Order[]>(`/admin/orders${qs}`, { signal });
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
