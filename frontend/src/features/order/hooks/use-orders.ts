import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/lib/api/client';
import {
  cancelOrder,
  createOrder,
  createPaymentIntent,
  getMyOrders,
  getOrder,
  type CreateOrderInput,
} from '@/features/order/api/orders';

// The current user's order history (newest first handled in the view).
export function useMyOrders() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['orders'],
    queryFn: ({ signal }) => getMyOrders(signal),
    enabled: !authLoading && !!user,
  });
}

// POST /orders — places the order (stock is reserved here). The Stripe intent is
// created lazily on the durable pay page, so checkout just returns the order and
// navigates there.
export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input),
    // A 409 means stock ran out between viewing the cart and placing the order;
    // refresh the cart so the stock-sync UI reflects the new live quantities.
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        void qc.invalidateQueries({ queryKey: ['cart'] });
      }
    },
  });
}

// Restore (or create) the Stripe PaymentIntent for a PENDING_PAYMENT order. Modelled
// as a query so the durable pay page recovers the clientSecret on mount/refresh; the
// backend reuses the in-flight intent (idempotent). Gated by `enabled` to the
// PENDING state, since the backend 400s otherwise. No retry: a 400 won't fix itself.
export function usePaymentIntent(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['payment-intent', orderId],
    queryFn: () => createPaymentIntent(orderId),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

// Cancel an unpaid order (releases stock). Refresh the affected order + the list.
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: (_data, orderId) => {
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// Polls while the order is still PENDING_PAYMENT (the webhook may lag behind the
// client confirm), stopping once it flips — and caps polling so a stuck order
// doesn't poll forever (~12s).
export function useOrder(id: string) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['order', id],
    queryFn: ({ signal }) => getOrder(id, signal),
    enabled: !authLoading && !!user,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && status !== 'PENDING_PAYMENT') return false;
      return query.state.dataUpdateCount < 6 ? 2000 : false;
    },
  });
}
