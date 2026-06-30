import { useQuery } from '@tanstack/react-query';

import { getCollection } from '@/features/collection/api/collections';

// Public single collection (used for the collection page heading).
export function useCollection(slug: string) {
  return useQuery({
    queryKey: ['collection', slug],
    queryFn: ({ signal }) => getCollection(slug, signal),
    enabled: !!slug,
  });
}
