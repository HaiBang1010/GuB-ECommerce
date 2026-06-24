// Public Supabase config. NEXT_PUBLIC_* vars are inlined by Next at build time;
// this throws clearly if they're missing so a misconfigured deploy fails loud
// instead of silently breaking auth. Only ever the ANON key here — never service_role.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — set them in frontend/.env.local',
    );
  }
  return { url, anonKey };
}
