'use client';

import { useState } from 'react';
import { Star, StarHalf } from 'lucide-react';

import { cn } from '@/lib/utils';

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: number;
  className?: string;
  label?: string;
};

const STARS = [1, 2, 3, 4, 5];

// One star-rating component. With `onChange` (and not readOnly) it is an
// interactive 1–5 input — real <button>s, so click / hover / keyboard all work.
// Otherwise it renders a read-only average with full / half / empty stars.
// lucide icons only, no extra rating library.
export function StarRating({
  value,
  onChange,
  readOnly,
  size = 20,
  className,
  label,
}: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const interactive = !readOnly && !!onChange;

  if (interactive) {
    const shown = hover ?? value;
    return (
      <div
        className={cn('flex items-center gap-0.5', className)}
        role="radiogroup"
        aria-label={label}
      >
        {STARS.map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={String(star)}
            className="rounded-sm p-0.5 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(null)}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                'transition-colors',
                star <= shown
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/40',
              )}
            />
          </button>
        ))}
      </div>
    );
  }

  // Read-only: round to the nearest half star so a 4.3 average still reads as 4.5.
  const rounded = Math.round(value * 2) / 2;
  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      aria-label={label ?? `${value.toFixed(1)} / 5`}
    >
      {STARS.map((star) => {
        const full = rounded >= star;
        const half = !full && rounded >= star - 0.5;
        const Icon = half ? StarHalf : Star;
        return (
          <Icon
            key={star}
            style={{ width: size, height: size }}
            className={cn(
              full || half
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground/40',
            )}
          />
        );
      })}
    </div>
  );
}
