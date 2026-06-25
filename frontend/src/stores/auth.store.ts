import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { Role } from '@/lib/api/me';

type AuthStore = {
  user: User | null;
  // App role from iam.User (via GET /me) — the single source of truth for admin
  // UI. null until resolved / when signed out. The backend RoleGuard is the gate.
  role: Role | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setRole: (role: Role | null) => void;
  setLoading: (v: boolean) => void;
};

// The real session lives in Supabase cookies; this store just mirrors it for the
// UI. NOT persisted — it's rehydrated from supabase.auth on every load (see Providers).
export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  role: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (isLoading) => set({ isLoading }),
}));
