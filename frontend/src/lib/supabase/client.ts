import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseEnv } from './env';

// Browser Supabase client, memoized so the whole app shares one instance (one
// auth listener, one token cache). Use only in client components.
let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = getSupabaseEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
