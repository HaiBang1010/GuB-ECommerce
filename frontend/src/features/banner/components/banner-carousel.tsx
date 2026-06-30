'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

import { useBanners } from '@/features/banner/hooks/use-banners';
import type { Banner } from '@/features/banner/api/banners';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const AUTOPLAY_MS = 5000;

// Full-width home banner region. The aspect-ratio frame keeps the layout stable in
// EVERY state (loading / empty / one / many) so the page never collapses or jumps —
// even before any banner is created or when an image URL fails to load.
export function BannerCarousel() {
  const t = useTranslations('banner');
  const { data, isPending } = useBanners();
  const banners = data ?? [];
  const [index, setIndex] = useState(0);

  // Reset to the first slide if the set shrinks (e.g. after an admin archive refetch).
  useEffect(() => {
    if (index > banners.length - 1) setIndex(0);
  }, [banners.length, index]);

  // Autoplay only with more than one slide; cleared on unmount / count change.
  useEffect(() => {
    if (banners.length <= 1) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % banners.length),
      AUTOPLAY_MS,
    );
    return () => clearInterval(id);
  }, [banners.length]);

  if (isPending) {
    return (
      <BannerFrame>
        <Skeleton className="h-full w-full" />
      </BannerFrame>
    );
  }

  if (banners.length === 0) {
    return (
      <BannerFrame>
        <Placeholder label={t('placeholder')} />
      </BannerFrame>
    );
  }

  const current = banners[Math.min(index, banners.length - 1)];
  const multiple = banners.length > 1;

  return (
    <BannerFrame>
      <BannerSlide banner={current} placeholderLabel={t('placeholder')} />

      {multiple ? (
        <>
          <CarouselButton
            side="left"
            label={t('previous')}
            onClick={() =>
              setIndex((i) => (i - 1 + banners.length) % banners.length)
            }
          >
            <ChevronLeft className="size-5" />
          </CarouselButton>
          <CarouselButton
            side="right"
            label={t('next')}
            onClick={() => setIndex((i) => (i + 1) % banners.length)}
          >
            <ChevronRight className="size-5" />
          </CarouselButton>

          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={t('goTo', { n: i + 1 })}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-2 rounded-full bg-white shadow transition-all',
                  i === index ? 'w-6' : 'w-2 opacity-60 hover:opacity-100',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </BannerFrame>
  );
}

// One slide: the image (wrapped in a link when linkUrl is set), falling back to the
// placeholder when the URL is empty or fails to load.
function BannerSlide({
  banner,
  placeholderLabel,
}: {
  banner: Banner;
  placeholderLabel: string;
}) {
  const [errored, setErrored] = useState(false);
  // Reset when the slide changes (carousel advanced to a different banner).
  useEffect(() => setErrored(false), [banner.imageUrl]);

  const broken = errored || !banner.imageUrl;
  const content = broken ? (
    <Placeholder label={placeholderLabel} />
  ) : (
    // Banner URLs are arbitrary external hosts (admin-entered) → next/image can't
    // whitelist them; a plain <img> with an onError fallback is the robust choice.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl}
      alt={banner.alt ?? banner.title ?? ''}
      onError={() => setErrored(true)}
      className="h-full w-full object-cover"
    />
  );

  if (banner.linkUrl && !broken) {
    return (
      <a href={banner.linkUrl} className="block h-full w-full">
        {content}
      </a>
    );
  }
  return content;
}

function BannerFrame({ children }: { children: ReactNode }) {
  return (
    <section className="bg-muted relative aspect-[16/9] w-full overflow-hidden sm:aspect-[16/5]">
      {children}
    </section>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-2">
      <ImageOff className="size-8 opacity-50" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function CarouselButton({
  side,
  label,
  onClick,
  children,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-black shadow transition hover:bg-white',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      {children}
    </button>
  );
}
