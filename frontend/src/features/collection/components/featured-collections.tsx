'use client';

import { useFeaturedCollections } from '@/features/collection/hooks/use-featured-collections';
import { CollectionRow } from '@/features/collection/components/collection-row';

// Home showcase: one carousel per admin-featured collection, in homeSortOrder (the
// backend already orders them). Renders NOTHING until there's at least one featured
// collection, so the whole region self-hides when nothing is curated.
export function FeaturedCollections() {
  const { data, isError } = useFeaturedCollections();

  if (isError) return null;
  const collections = data ?? [];
  if (collections.length === 0) return null;

  return (
    <>
      {collections.map((c) => (
        <CollectionRow key={c.id} collection={c} />
      ))}
    </>
  );
}
