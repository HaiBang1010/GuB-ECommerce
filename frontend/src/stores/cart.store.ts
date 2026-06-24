import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type CartSnapshot = {
  nameVi: string;
  nameEn: string;
  slug: string;
  imageUrl: string | null;
};

type CartStore = {
  // Stable id sent as X-Cart-Session so the backend keys a server-side guest cart
  // to this browser. The server cart is the single source of truth for quantities.
  sessionId: string;
  // Display cache: the cart API returns no name/image, so we remember them per
  // variant when adding from the product page (and after login they may be empty
  // for items merged from another device — the cart UI falls back to the SKU).
  snapshots: Record<string, CartSnapshot>;
  setSnapshot: (variantId: string, snap: CartSnapshot) => void;
  // After a successful merge-on-login (or sign-out): start a fresh empty guest session.
  resetSession: () => void;
  // On sign-out: drop the display cache.
  clear: () => void;
};

// Avoid touching localStorage during SSR — this module is evaluated on the server
// while pre-rendering client components.
const memoryFallback = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      sessionId: crypto.randomUUID(),
      snapshots: {},
      setSnapshot: (variantId, snap) =>
        set((s) => ({ snapshots: { ...s.snapshots, [variantId]: snap } })),
      resetSession: () =>
        set({ sessionId: crypto.randomUUID(), snapshots: {} }),
      clear: () => set({ snapshots: {} }),
    }),
    {
      name: 'gub-cart',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : memoryFallback,
      ),
    },
  ),
);
