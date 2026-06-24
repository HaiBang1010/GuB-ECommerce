import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
  type CartView,
} from '@/lib/api/cart';

// The server cart serves BOTH guest (X-Cart-Session) and user (Bearer). Wait for
// auth to settle so the first fetch carries the token when logged in.
export function useCart() {
  const authLoading = useAuthStore((s) => s.isLoading);
  return useQuery({
    queryKey: ['cart'],
    queryFn: getCart,
    enabled: !authLoading,
  });
}

// Every cart mutation returns the full cart view, so we write it straight into
// the cache instead of refetching.
export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      variantId,
      quantity,
    }: {
      variantId: string;
      quantity: number;
    }) => addCartItem(variantId, quantity),
    onSuccess: (data) => qc.setQueryData<CartView>(['cart'], data),
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      variantId,
      quantity,
    }: {
      variantId: string;
      quantity: number;
    }) => updateCartItem(variantId, quantity),
    onSuccess: (data) => qc.setQueryData<CartView>(['cart'], data),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: string) => removeCartItem(variantId),
    onSuccess: (data) => qc.setQueryData<CartView>(['cart'], data),
  });
}
