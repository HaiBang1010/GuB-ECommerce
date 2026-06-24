import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

type AuthStore = {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (v: boolean) => void;
};

// The real session lives in Supabase cookies; this store just mirrors it for the
// UI. NOT persisted — it's rehydrated from supabase.auth on every load (see Providers).
export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}));
