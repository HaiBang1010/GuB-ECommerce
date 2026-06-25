'use client';

import { ShoppingCart, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useCart } from '@/hooks/use-cart';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const t = useTranslations('auth');
  const tNav = useTranslations('nav');
  const tCart = useTranslations('cart');
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { data: cart } = useCart();

  // Badge = number of distinct variants in the cart, NOT the total quantity.
  const count = cart?.items.length ?? 0;

  async function handleSignOut() {
    await createClient().auth.signOut();
  }

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          GuB
        </Link>

        <nav className="flex items-center gap-2">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={tNav('account')}>
                  <User className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {user.email ? (
                  <DropdownMenuLabel className="text-muted-foreground max-w-[12rem] truncate font-normal">
                    {user.email}
                  </DropdownMenuLabel>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link href="/orders">{tNav('myOrders')}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  {tNav('vouchers')}
                  <span className="text-muted-foreground text-xs">
                    {tNav('comingSoon')}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  {tNav('reviews')}
                  <span className="text-muted-foreground text-xs">
                    {tNav('comingSoon')}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
