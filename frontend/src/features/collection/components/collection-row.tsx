'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { useCollectionProducts } from '@/features/collection/hooks/use-collection-products';
import type { Collection } from '@/features/collection/api/collections';
import { ProductCarousel } from '@/components/product-carousel';
import { Skeleton } from '@/components/ui/skeleton';

// One home showcase row for a featured collection: title (locale name) + "See more"
// link to the collection page + a product carousel. Shows a skeleton while loading and
// renders NOTHING when the collection has no active products, so a featured-but-empty
// collection never leaves a gap on the home page.
export function CollectionRow({ collection }: { collection: Collection }) {
  const locale = useLocale();
  const t = useTranslations('Home');
  const { data, isPending, isError } = useCollectionProducts(collection.slug);

  const title = locale === 'vi' ? collection.nameVi : collection.nameEn;

  if (isError) return null;
  if (!isPending && (!data || data.length === 0)) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Link
          href={`/collections/${collection.slug}`}
          className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-1 text-sm"
        >
          {t('seeMore')}
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
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
