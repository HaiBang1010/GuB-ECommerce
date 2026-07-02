'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { useProducts } from '@/features/product/hooks/use-products';
import type { ProductListParams } from '@/features/product/api/products';
import { ProductCarousel } from '@/components/product-carousel';
import { Skeleton } from '@/components/ui/skeleton';

// A titled home product row backed by a product query. Shows a skeleton while
// loading; renders NOTHING when the query errors or returns no products, so an
// accent row never breaks or leaves an empty gap on the home page.
export function ProductRow({
  title,
  params,
  seeMoreHref,
}: {
  title: string;
  params: ProductListParams;
  seeMoreHref?: string;
}) {
  const t = useTranslations('Home');
  const { data, isPending, isError } = useProducts(params);

  if (isError) return null;
  if (!isPending && (!data || data.length === 0)) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        {seeMoreHref ? (
          <Link
            href={seeMoreHref}
            className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-1 text-sm"
          >
            {t('seeMore')}
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>

      {isPending ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              className="aspect-square w-[60%] shrink-0 sm:w-[45%] lg:w-[23%]"
            />
          ))}
        </div>
      ) : (
        <ProductCarousel products={data ?? []} />
      )}
    </section>
  );
}
