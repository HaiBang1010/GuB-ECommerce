import { useQuery } from '@tanstack/react-query';

import { getCollectionProducts } from '@/features/collection/api/collections';

// Public products in a collection (home rows + the collection page share this cache).
export function useCollectionProducts(slug: string) {
  return useQuery({
    queryKey: ['collection', slug, 'products'],
    queryFn: ({ signal }) => getCollectionProducts(slug, signal),
    enabled: !!slug,
  });
}
