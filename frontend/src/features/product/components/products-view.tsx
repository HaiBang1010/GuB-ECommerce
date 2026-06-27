'use client';

import { useTranslations } from 'next-intl';

import { useProducts } from '@/features/product/hooks/use-products';
import { ProductCard } from '@/features/product/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';

const GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function ProductsView() {
  const t = useTranslations('Products');
  const query = useProducts();

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

  return (
    <div className={GRID_CLASS}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
