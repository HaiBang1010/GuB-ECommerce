'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { ProductCard } from '@/features/product/components/product-card';
import type { Product } from '@/features/product/api/products';
import { cn } from '@/lib/utils';

// Shared horizontal product carousel: a scroll-snap row that shows a WHOLE number of
// cards per viewport — 2 on mobile, 3 on tablet, 4 on desktop — so no half card peeks.
// Each card's flex-basis is (100% − gaps)/N (gap-4 = 1rem), so N cards + (N−1) gaps fill
// the viewport exactly. Prev/next page by one viewport width and snap-start realigns to
// the next card edge → the next click reveals exactly the next N cards. Arrows show only
// when the row overflows and disable at each end. Reused by the home rows + collection
// showcase — the parent owns the data + empty handling.
export function ProductCarousel({ products }: { products: Product[] }) {
  const t = useTranslations('carousel');
  const scroller = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflow(max > 1);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    return () => {
      el.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [sync]);

  // Recompute when the set changes (a row can go from fitting to overflowing).
  useEffect(() => {
    sync();
  }, [products, sync]);

  // Page by exactly one viewport; snap-mandatory + snap-start realign to the next card.
  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div
            key={p.id}
            className="shrink-0 grow-0 basis-[calc((100%-1rem)/2)] snap-start sm:basis-[calc((100%-2rem)/3)] lg:basis-[calc((100%-3rem)/4)]"
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      {overflow ? (
        <>
          <Arrow
            side="left"
            label={t('previous')}
            disabled={atStart}
            onClick={() => page(-1)}
          />
          <Arrow
            side="right"
            label={t('next')}
            disabled={atEnd}
            onClick={() => page(1)}
          />
        </>
      ) : null}
    </div>
  );
}

function Arrow({
  side,
  label,
  disabled,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'absolute top-1/3 z-10 hidden -translate-y-1/2 rounded-full bg-white/90 p-1.5 shadow ring-1 ring-black/5 transition hover:bg-white disabled:pointer-events-none disabled:opacity-0 sm:block',
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
