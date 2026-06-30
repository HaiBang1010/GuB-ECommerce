import { useQuery } from '@tanstack/react-query';

import { getCategories } from '@/features/category/api/categories';

// Public storefront categories (the home grid) — NOT auth-gated, since the home page
// renders them for guests too (like useBanners).
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => getCategories(signal),
  });
}
