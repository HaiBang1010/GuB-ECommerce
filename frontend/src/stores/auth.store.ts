import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Role } from '@/lib/api/me';

// Lifecycle of the app role fetch (GET /me). Distinguishing 'loading' from a
// resolved-null role is what stops the admin guard from bouncing an admin during
// the brief window after the session restores but before /me returns.
export type RoleStatus = 'idle' | 'loading' | 'loaded';

type AuthStore = {
  user: User | null;
  // App role from iam.User (via GET /me) — the single source of truth for admin
  // UI. null until resolved / when signed out. The backend RoleGuard is the gate.
  role: Role | null;
  roleStatus: RoleStatus;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  // Resolve the role (success OR best-effort null) — both mark it 'loaded'.
  setRole: (role: Role | null) => void;
  setRoleStatus: (status: RoleStatus) => void;
  // Signed out / no session: clear the role back to the unresolved 'idle' state.
  clearRole: () => void;
  setLoading: (v: boolean) => void;
};

// The real session lives in Supabase cookies; this store just mirrors it for the
// UI. NOT persisted — it's rehydrated from supabase.auth on every load (see Providers).
export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  role: null,
  roleStatus: 'idle',
  isLoading: true,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role, roleStatus: 'loaded' }),
  setRoleStatus: (roleStatus) => set({ roleStatus }),
  clearRole: () => set({ role: null, roleStatus: 'idle' }),
  setLoading: (isLoading) => set({ isLoading }),
}));
