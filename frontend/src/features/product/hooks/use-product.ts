import { useQuery } from '@tanstack/react-query';

import { getProduct } from '@/features/product/api/products';

// Server state for a single product detail (product + variants + images).
export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProduct(slug),
  });
}
