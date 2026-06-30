'use client';

import { useTranslations } from 'next-intl';

import { useProducts } from '@/features/product/hooks/use-products';
import { ProductGrid } from '@/features/product/components/product-grid';
import { Skeleton } from '@/components/ui/skeleton';

const GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

// `category` is the optional slug filter from the page's ?category= search param
// (set by the home category grid); omitted, the view lists every active product.
export function ProductsView({ category }: { category?: string }) {
  const t = useTranslations('Products');
  const query = useProducts({ category });

  if (query.isPending) {
    return (
      <div className={GRID_CLASS}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return <p className="text-destructive">{t('error')}</p>;
  }

  const products = query.data;
  if (products.length === 0) {
    return <p className="text-muted-foreground">{t('empty')}</p>;
  }

  return <ProductGrid products={products} />;
}
