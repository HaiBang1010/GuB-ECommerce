'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth.store';

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
  const setLoading = useAuthStore((s) => s.setLoading);

  // Mirror the Supabase session into the auth store: read it once on mount, then
  // keep it in sync via onAuthStateChange.
  useEffect(() => {
    const supabase = createClient();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'SIGNED_IN') {
        // TODO (slice 4): trigger cart merge (guest cart -> user cart)
      }
      if (event === 'SIGNED_OUT') {
        // TODO (slice 4): clear the guest cart store
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setUser, setLoading]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
