import { useQuery } from '@tanstack/react-query';

import { getProducts, type ProductListParams } from '@/lib/api/products';

// Server state for the storefront product list. The params object is part of the
// query key so different search/category combinations cache independently.
export function useProducts(params: ProductListParams = {}) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => getProducts(params),
  });
}
