'use client';

import { AtSign, Globe, MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

// Static storefront footer (no DB). Rendered only by the storefront layout, so it
// never appears in the (admin) route group. Social links are placeholders (href="#").
export function Footer() {
  const t = useTranslations('footer');
  // Client component → reading the year in the browser is fine (no hydration issue
  // since the year is stable for the session).
  const year = new Date().getFullYear();

  // lucide dropped brand icons; these generic placeholders stand in for the social
  // links (href="#" until real profiles exist). Labels keep the platform names.
  const socials = [
    { label: 'Facebook', Icon: Globe },
    { label: 'Instagram', Icon: AtSign },
    { label: 'Twitter', Icon: MessageCircle },
  ] as const;

  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-10 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-lg font-semibold">GuB</span>
          <p className="text-muted-foreground max-w-xs text-sm">{t('tagline')}</p>
        </div>

        <nav className="flex flex-col gap-2 text-sm">
          <span className="font-medium">{t('shop')}</span>
          <Link href="/products" className="text-muted-foreground hover:text-foreground">
            {t('products')}
          </Link>
          <a href="#" className="text-muted-foreground hover:text-foreground">
            {t('about')}
          </a>
          <a href="#" className="text-muted-foreground hover:text-foreground">
            {t('contact')}
          </a>
        </nav>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('followUs')}</span>
          <div className="flex items-center gap-3">
            {socials.map(({ label, Icon }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon className="size-5" />
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="text-muted-foreground border-t px-4 py-4 text-center text-xs">
        {t('rights', { year })}
      </div>
    </footer>
  );
}
