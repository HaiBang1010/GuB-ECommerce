'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import type { SizeSuggestion } from '@/features/product/api/size-suggestion';

const FIT_KEY = {
  SNUG: 'fitSnug',
  PERFECT: 'fitPerfect',
  LOOSE: 'fitLoose',
} as const;

// Rule-based size hint near the size selector. Renders only when there's something
// to say: a suggested size, or a nudge to fill in measurements. NO_CHART / NO_MATCH
// (and guests, handled by the caller) render nothing.
export function SuggestedSize({
  suggestion,
  onPick,
}: {
  suggestion: SizeSuggestion | undefined;
  onPick: (size: string) => void;
}) {
  const t = useTranslations('product');
  if (!suggestion) return null;

  if (suggestion.status === 'SUGGESTED' && suggestion.suggestedSize) {
    const size = suggestion.suggestedSize;
    const fit = suggestion.fit ? t(FIT_KEY[suggestion.fit]) : null;
    return (
      <div className="bg-muted flex flex-wrap items-center gap-2 rounded-md p-3 text-sm">
        <span>{t('suggestedFor', { size })}</span>
        {fit ? <span className="text-muted-foreground text-xs">{fit}</span> : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => onPick(size)}
        >
          {t('useThisSize')}
        </Button>
      </div>
    );
  }

  if (suggestion.status === 'NO_PROFILE') {
    return (
      <p className="text-muted-foreground text-sm">
        {t('enterMeasurements')}{' '}
        <Link href="/account/profile" className="text-primary underline">
          {t('goToProfile')}
        </Link>
      </p>
    );
  }

  return null;
}
