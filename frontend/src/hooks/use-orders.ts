import { useMutation, useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  createOrder,
  createPaymentIntent,
  getMyOrders,
  getOrder,
} from '@/lib/api/orders';

// The current user's order history (newest first handled in the view).
export function useMyOrders() {
  const authLoading = useAuthStore((s) => s.isLoading);
  return useQuery({
    queryKey: ['orders'],
    queryFn: getMyOrders,
    enabled: !authLoading,
  });
}

// The backend splits create-order and create-payment-intent, so chain them:
// POST /orders -> POST /payments/intent. Returns the order + Stripe clientSecret.
export function useCreateOrder() {
  return useMutation({
    mutationFn: async (addressId: string) => {
      const order = await createOrder(addressId);
      const intent = await createPaymentIntent(order.id);
      return { order, clientSecret: intent.clientSecret };
    },
  });
}

// Re-create/reuse the Stripe PaymentIntent for an existing PENDING_PAYMENT order
// (pay-again). The backend reuses the in-flight intent and 400s if the order is
// no longer awaiting payment.
export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: (orderId: string) => createPaymentIntent(orderId),
  });
}

// Polls while the order is still PENDING_PAYMENT (the webhook may lag behind the
// client confirm), stopping once it flips — and caps polling so a stuck order
// doesn't poll forever (~12s).
export function useOrder(id: string) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && status !== 'PENDING_PAYMENT') return false;
      return query.state.dataUpdateCount < 6 ? 2000 : false;
    },
  });
}
