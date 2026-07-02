import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  getChatThread,
  markChatRead,
  sendChatMessage,
} from '@/features/chat/api/chat';

// The customer's support thread. Auth-gated (never fires for guests) and polled as
// the fallback for the realtime Broadcast layer (mirrors useNotifications). The
// Broadcast subscription invalidates this same key for an instant update.
export function useChatThread() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['chat', 'thread'],
    queryFn: ({ signal }) => getChatThread(signal),
    enabled: !authLoading && !!user,
    refetchInterval: 60_000,
  });
}

export function useSendChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendChatMessage(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chat', 'thread'] });
    },
  });
}

export function useMarkChatRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markChatRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chat', 'thread'] });
    },
  });
}
