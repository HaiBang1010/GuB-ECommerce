import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Order = components['schemas']['OrderResponseDto'];
export type OrderItem = components['schemas']['OrderItemDto'];
export type PaymentIntentResult =
  components['schemas']['PaymentIntentResponseDto'];

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

// GET /orders/:id — one of the user's orders.
export function getOrder(id: string): Promise<Order> {
  return apiFetch<Order>(`/orders/${encodeURIComponent(id)}`);
}
