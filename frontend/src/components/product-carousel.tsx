'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { ProductCard } from '@/features/product/components/product-card';
import type { Product } from '@/features/product/api/products';
import { cn } from '@/lib/utils';

// Shared horizontal product carousel: scroll-snap row of ProductCards with desktop
// prev/next arrows (touch users swipe). Reused by the home rows and (later) the
// collection showcase. Dumb component — the parent owns the data + empty handling.
export function ProductCarousel({ products }: { products: Product[] }) {
  const t = useTranslations('carousel');
  const scroller = useRef<HTMLDivElement>(null);

  function page(dir: 1 | -1) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div
            key={p.id}
            className="w-[60%] shrink-0 snap-start sm:w-[45%] lg:w-[23%]"
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      {products.length > 1 ? (
        <>
          <Arrow side="left" label={t('previous')} onClick={() => page(-1)} />
          <Arrow side="right" label={t('next')} onClick={() => page(1)} />
        </>
      ) : null}
    </div>
  );
}

function Arrow({
  side,
  label,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'absolute top-1/3 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-black/5 transition hover:bg-white sm:block',
        side === 'left' ? '-left-3' : '-right-3',
      )}
    >
      {side === 'left' ? (
        <ChevronLeft className="size-5" />
      ) : (
        <ChevronRight className="size-5" />
      )}
    </button>
  );
}
