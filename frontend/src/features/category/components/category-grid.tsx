'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ImageOff } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { useCategories } from '@/features/category/hooks/use-categories';
import type { CategoryNode } from '@/features/category/api/categories';
import { Skeleton } from '@/components/ui/skeleton';

// Home "Shop by category" grid: active top-level categories as image+name tiles that
// link to the filtered product list. Renders NOTHING when the query errors or there
// are no categories, so the section never leaves an empty gap on the home page.
export function CategoryGrid() {
  const t = useTranslations('Home');
  const { data, isPending, isError } = useCategories();

  // The public tree returns top-level nodes already; keep only the active ones.
  const categories = (data ?? []).filter((c) => c.archivedAt === null);

  if (isError) return null;
  if (!isPending && categories.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-10">
      <h2 className="mb-3 text-xl font-semibold">{t('shopByCategory')}</h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {isPending
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-lg" />
            ))
          : categories.map((c) => <CategoryTile key={c.id} category={c} />)}
      </div>
    </section>
  );
}

function CategoryTile({ category }: { category: CategoryNode }) {
  const locale = useLocale();
  const [errored, setErrored] = useState(false);
  const name = locale === 'vi' ? category.nameVi : category.nameEn;
  const broken = errored || !category.imageUrl;

  return (
    <Link
      href={`/products?category=${encodeURIComponent(category.slug)}`}
      className="group relative block aspect-square overflow-hidden rounded-lg border"
    >
      <div className="bg-muted text-muted-foreground absolute inset-0 flex items-center justify-center">
        {broken ? (
          <ImageOff className="size-7 opacity-50" />
        ) : (
          // Category images are arbitrary external hosts (admin-entered URL) →
          // next/image can't whitelist them; plain <img> + onError fallback.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={category.imageUrl ?? ''}
            alt={name}
            onError={() => setErrored(true)}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
        <span className="text-sm font-medium text-white">{name}</span>
      </div>
    </Link>
  );
}
