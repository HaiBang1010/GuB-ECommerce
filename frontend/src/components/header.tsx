'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function Header() {
  const t = useTranslations('auth');
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  async function handleSignOut() {
    await createClient().auth.signOut();
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          GuB
        </Link>

        <nav className="flex items-center gap-3">
          {isLoading ? null : user ? (
            <>
              <span className="text-muted-foreground hidden text-sm sm:inline">
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                {t('logout')}
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/auth/login">{t('login')}</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
