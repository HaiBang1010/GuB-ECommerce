'use client';

import { ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useCart } from '@/hooks/use-cart';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

export function Header() {
  const t = useTranslations('auth');
  const tCart = useTranslations('cart');
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { data: cart } = useCart();

  const count = cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

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
          <Link
            href="/cart"
            aria-label={tCart('title')}
            className="relative inline-flex p-1"
          >
            <ShoppingCart className="size-5" />
            {count > 0 ? (
              <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none">
                {count}
              </span>
            ) : null}
          </Link>

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
