'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

// Floating "scroll to top" button for the storefront. Hidden at the top of the page,
// fades/scales in after scrolling past ~300px. Mounted by the storefront layout only
// (never the admin shell). Smooth scroll on click.
export function BackToTop() {
  const t = useTranslations('common');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll(); // sync on mount (e.g. restored scroll position)
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label={t('backToTop')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={cn(
        'bg-primary text-primary-foreground fixed bottom-5 left-5 z-50 rounded-full p-3 shadow-lg transition-all duration-300 hover:brightness-110',
        visible
          ? 'scale-100 opacity-100'
          : 'pointer-events-none scale-90 opacity-0',
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
