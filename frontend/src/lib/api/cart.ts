import { apiFetch } from '@/lib/api/client';
import { useCartStore } from '@/stores/cart.store';
import type { components } from '@/lib/api/schema';

export type CartView = components['schemas']['CartViewDto'];
export type CartItemView = components['schemas']['CartItemViewDto'];

// Every cart request carries the guest session header. For a logged-in user the
// backend prefers the Bearer token (added by apiFetch) and ignores this — except
// /cart/merge, which needs both.
function sessionHeaders(): Record<string, string> {
  return { 'X-Cart-Session': useCartStore.getState().sessionId };
}

const jsonHeaders = () => ({
  ...sessionHeaders(),
  'Content-Type': 'application/json',
});

// GET /cart — works for guest (X-Cart-Session) or user (Bearer).
export function getCart(): Promise<CartView> {
  return apiFetch<CartView>('/cart', { headers: sessionHeaders() });
}

// POST /cart/items — quantity is an INCREMENT (accumulates server-side).
export function addCartItem(
  variantId: string,
  quantity: number,
): Promise<CartView> {
  return apiFetch<CartView>('/cart/items', {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ variantId, quantity }),
  });
}

// PATCH /cart/items/:variantId — quantity is ABSOLUTE (>= 1).
export function updateCartItem(
  variantId: string,
  quantity: number,
): Promise<CartView> {
  return apiFetch<CartView>(`/cart/items/${encodeURIComponent(variantId)}`, {
    method: 'PATCH',
    headers: jsonHeaders(),
    body: JSON.stringify({ quantity }),
  });
}

// DELETE /cart/items/:variantId — remove a line.
export function removeCartItem(variantId: string): Promise<CartView> {
  return apiFetch<CartView>(`/cart/items/${encodeURIComponent(variantId)}`, {
    method: 'DELETE',
    headers: sessionHeaders(),
  });
}

// POST /cart/merge — empty body; needs Bearer (apiFetch) + X-Cart-Session.
export function mergeCart(): Promise<CartView> {
  return apiFetch<CartView>('/cart/merge', {
    method: 'POST',
    headers: sessionHeaders(),
  });
}
