'use client';

import { useLocale, useTranslations } from 'next-intl';

import { useCollection } from '@/features/collection/hooks/use-collection';
import { useCollectionProducts } from '@/features/collection/hooks/use-collection-products';
import { ProductGrid } from '@/features/product/components/product-grid';
import { Skeleton } from '@/components/ui/skeleton';

const GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

// Storefront collection page: the collection name as a heading + its products laid out
// with the shared ProductGrid. Reuses the Products namespace for the empty/error copy.
export function CollectionView({ slug }: { slug: string }) {
  const locale = useLocale();
  const t = useTranslations('Products');
  const collection = useCollection(slug);
  const products = useCollectionProducts(slug);

  const title = collection.data
    ? locale === 'vi'
      ? collection.data.nameVi
      : collection.data.nameEn
    : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      {title ? (
        <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      ) : (
        <Skeleton className="mb-6 h-8 w-48" />
      )}

      {products.isPending ? (
        <div className={GRID_CLASS}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : products.isError || collection.isError ? (
        <p className="text-destructive">{t('error')}</p>
      ) : !products.data || products.data.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <ProductGrid products={products.data} />
      )}
    </main>
  );
}
