'use client';

import { useEffect, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';

import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { isAdmin } from '@/lib/auth/is-admin';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Sidebar entries. Orders + Reviews are wired; catalog/analytics are honest "coming
// soon" placeholders (they land in later phases). The customer user-detail page is
// reached via the customer link on an order, so it needs no sidebar entry.
const NAV_ITEMS = [
  { key: 'orders', href: '/admin/orders' },
  { key: 'reviews', href: '/admin/reviews' },
  { key: 'catalog', href: null },
  { key: 'analytics', href: null },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const isLoading = useAuthStore((s) => s.isLoading);
  const role = useAuthStore((s) => s.role);
  const roleStatus = useAuthStore((s) => s.roleStatus);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();

  const admin = isAdmin(role);
  // Still settling if the session is restoring, OR we're logged in but the role
  // fetch (GET /me) hasn't resolved yet. We must NOT treat that null role as
  // "not an admin" — that's the refresh race that bounced real admins.
  const resolving = isLoading || (user != null && roleStatus !== 'loaded');

  // Client-side convenience guard ONLY — every /admin/* API call is still gated by
  // the backend RoleGuard (403), the real protection. Redirect only once both the
  // session AND the role have settled and the caller is definitively not an admin.
  useEffect(() => {
    if (!resolving && !admin) {
      router.replace('/');
    }
  }, [resolving, admin, router]);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.replace('/');
  }

  if (resolving) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">{t('loading')}</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">{t('unauthorized')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Admin topbar — no cart/bell; just brand + account + sign out. */}
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/admin/orders" className="text-lg font-semibold">
            {t('title')}
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="size-4" />
                {t('backToShop')}
              </Link>
            </Button>
            {user?.email ? (
              <span className="text-muted-foreground max-w-[12rem] truncate text-sm">
                {user.email}
              </span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              {t('logout')}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        {/* Sidebar */}
        <aside className="w-48 shrink-0 border-r p-3">
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) =>
              item.href ? (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium',
                    pathname.startsWith(item.href)
                      ? 'bg-muted'
                      : 'text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {t(item.key)}
                </Link>
              ) : (
                <span
                  key={item.key}
                  className="text-muted-foreground/60 flex flex-col rounded-md px-3 py-2 text-sm"
                >
                  {t(item.key)}
                  <span className="text-xs">{t('comingSoon')}</span>
                </span>
              ),
            )}
          </nav>
        </aside>

        {/* Page content */}
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
