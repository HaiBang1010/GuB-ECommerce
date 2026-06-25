'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { mergeCart } from '@/lib/api/cart';
import { getMe } from '@/lib/api/me';

// Client-only provider tree. The locale layout is a server component, so context
// providers (TanStack Query) and the auth-session bridge live here.
export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session — created lazily so it survives re-renders
  // but is never shared across requests on the server.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const setUser = useAuthStore((s) => s.setUser);
  const setRole = useAuthStore((s) => s.setRole);
  const setLoading = useAuthStore((s) => s.setLoading);

  // Mirror the Supabase session into the auth store: read it once on mount, then
  // keep it in sync via onAuthStateChange.
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Resolve the app role from the backend (reads iam.User.role) — the single
    // source of truth. Best-effort: a failure leaves role null, so the UI just
    // hides admin affordances (the backend RoleGuard is the real gate).
    const syncRole = (hasSession: boolean) => {
      if (!hasSession) {
        setRole(null);
        return;
      }
      void getMe()
        .then((me) => {
          if (active) setRole(me.role);
        })
        .catch(() => {
          if (active) setRole(null);
        });
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
      syncRole(!!data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN') {
        syncRole(true);
        // Fold the guest cart (X-Cart-Session) into the user cart, then start a
        // fresh empty guest session. mergeCart no-ops when there's no guest cart,
        // so a repeated SIGNED_IN (e.g. token refresh) is harmless.
        void mergeCart()
          .catch(() => undefined)
          .finally(() => {
            useCartStore.getState().resetSession();
            void queryClient.invalidateQueries({ queryKey: ['cart'] });
          });
      }
      if (event === 'SIGNED_OUT') {
        setRole(null);
        useCartStore.getState().clear();
        void queryClient.invalidateQueries({ queryKey: ['cart'] });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setUser, setRole, setLoading, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
