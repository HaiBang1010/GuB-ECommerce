import { create } from 'zustand';

type ChatUiStore = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

// Chat panel open/close state, shared so the notification bell's CHAT_REPLY item can
// open the widget from the header. Not persisted (rebuilt each load).
export const useChatUiStore = create<ChatUiStore>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
