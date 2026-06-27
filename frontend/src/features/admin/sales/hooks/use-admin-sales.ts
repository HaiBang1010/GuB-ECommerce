import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  getAdminProducts,
  setProductSale,
} from '@/features/admin/sales/api/products';

// Admin: the full product catalog (incl. archived) for the Sales page. Gated to a
// logged-in user; the backend RoleGuard rejects non-admins.
export function useAdminProducts() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'products'],
    queryFn: ({ signal }) => getAdminProducts(signal),
    enabled: !authLoading && !!user,
  });
}

// Set (number) or clear (null) a product's sale price, then refresh the list.
export function useSetProductSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      salePriceCents,
    }: {
      id: string;
      salePriceCents: number | null;
    }) => setProductSale(id, salePriceCents),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
  });
}
