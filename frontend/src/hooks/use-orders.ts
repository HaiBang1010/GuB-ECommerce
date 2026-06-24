import { useMutation, useQuery } from '@tanstack/react-query';

import {
  createOrder,
  createPaymentIntent,
  getOrder,
} from '@/lib/api/orders';

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
