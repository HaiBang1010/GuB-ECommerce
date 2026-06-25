import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/auth.store';
import { ApiError } from '@/lib/api/client';
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

// The backend rejects (400 "Only N left in stock.") instead of silently capping,
// so a stock limit surfaces as a mutation error, not a quantity diff.
function useCartErrorToast() {
  const t = useTranslations('cart');
  return (err: unknown) => {
    if (err instanceof ApiError && err.status === 400) {
      toast.warning(t('maxQuantityReached'));
    } else {
      toast.error(t('error'));
    }
  };
}

// Every cart mutation returns the full cart view, so we write it straight into
// the cache instead of refetching.
export function useAddToCart() {
  const qc = useQueryClient();
  const t = useTranslations('cart');
  const onError = useCartErrorToast();
  return useMutation({
    mutationFn: ({
      variantId,
      quantity,
    }: {
      variantId: string;
      quantity: number;
    }) => addCartItem(variantId, quantity),
    onSuccess: (data) => {
      qc.setQueryData<CartView>(['cart'], data);
      toast.success(t('addedToCart'));
    },
    onError,
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  const onError = useCartErrorToast();
  return useMutation({
    mutationFn: ({
      variantId,
      quantity,
    }: {
      variantId: string;
      quantity: number;
    }) => updateCartItem(variantId, quantity),
    onSuccess: (data) => qc.setQueryData<CartView>(['cart'], data),
    onError,
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  const t = useTranslations('cart');
  return useMutation({
    mutationFn: (variantId: string) => removeCartItem(variantId),
    onSuccess: (data) => qc.setQueryData<CartView>(['cart'], data),
    onError: () => toast.error(t('error')),
  });
}
