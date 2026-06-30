import { useQuery } from '@tanstack/react-query';

import { getFeaturedCollections } from '@/features/collection/api/collections';

// Public home-featured collections — NOT auth-gated (shown to guests on the home page).
export function useFeaturedCollections() {
  return useQuery({
    queryKey: ['collections', 'featured'],
    queryFn: ({ signal }) => getFeaturedCollections(signal),
  });
}
