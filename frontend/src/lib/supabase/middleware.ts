import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';

import { getSupabaseEnv } from './env';

// Refreshes the Supabase session and returns the current user. Cookies are written
// onto `response` (the response produced by next-intl middleware) so the refreshed
// session rides along with locale routing. Runs in the Edge middleware.
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<User | null> {
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
