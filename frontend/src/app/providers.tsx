'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { mergeCart } from '@/features/cart/api/cart';
import { getMe } from '@/features/auth/api/me';

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
  const setRoleStatus = useAuthStore((s) => s.setRoleStatus);
  const clearRole = useAuthStore((s) => s.clearRole);
  const setLoading = useAuthStore((s) => s.setLoading);

  // Mirror the Supabase session into the auth store: read it once on mount, then
  // keep it in sync via onAuthStateChange.
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    // supabase-js re-emits SIGNED_IN on every tab refocus. We track the last
    // already-synced user id so a redundant same-user re-emit is a no-op — otherwise
    // it would reset roleStatus to 'loading' (unmounting admin pages mid-edit) and
    // re-run the guest-cart merge on every focus. Only a NEW user id is a real login.
    let lastUserId: string | null = null;

    // Resolve the app role from the backend (reads iam.User.role) — the single
    // source of truth. roleStatus goes loading→loaded so the admin guard can tell
    // "still fetching" apart from "resolved, not an admin". Best-effort: a failure
    // leaves role null (UI hides admin affordances; backend RoleGuard is the gate).
    const syncRole = (hasSession: boolean) => {
      if (!hasSession) {
        clearRole();
        return;
      }
      setRoleStatus('loading');
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
      lastUserId = data.session?.user?.id ?? null;
      syncRole(!!data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      setUser(session?.user ?? null);
      setLoading(false);

      // Keep Supabase Realtime authorized with the freshest token so an open private
      // chat channel (chat:user:<id>) survives a token refresh (fires on
      // INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED). No-op when signed out.
      if (session) {
        void supabase.realtime.setAuth(session.access_token);
      }

      // Only a NEW user id is a genuine sign-in / account switch. A redundant
      // SIGNED_IN re-emitted for the already-synced user (fired on every tab
      // refocus) is skipped — so it never flips roleStatus back to 'loading'
      // (which would unmount admin pages and lose in-progress form state), nor
      // re-runs the guest-cart merge.
      if (event === 'SIGNED_IN' && uid !== lastUserId) {
        lastUserId = uid;
        syncRole(true);
        // Fold the guest cart (X-Cart-Session) into the user cart, then start a
        // fresh empty guest session.
        void mergeCart()
          .catch(() => undefined)
          .finally(() => {
            useCartStore.getState().resetSession();
            void queryClient.invalidateQueries({ queryKey: ['cart'] });
          });
      }
      if (event === 'SIGNED_OUT') {
        lastUserId = null;
        clearRole();
        useCartStore.getState().clear();
        void queryClient.invalidateQueries({ queryKey: ['cart'] });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setUser, setRole, setRoleStatus, clearRole, setLoading, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}
