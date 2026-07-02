import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  adminReplyToConversation,
  getAdminConversation,
  getAdminConversations,
  markAdminConversationRead,
  type SendMessageBody,
} from '@/features/admin/chat/api/chat';

// Conversation list — light poll so new conversations / unread counts surface without
// realtime (admin side is poll-only by design; the customer still gets Broadcast).
export function useAdminConversations(
  search?: string,
  page = 1,
  pageSize = 10,
) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const term = search?.trim() ?? '';
  return useQuery({
    queryKey: ['admin', 'chat', 'conversations', { search: term, page, pageSize }],
    queryFn: ({ signal }) =>
      getAdminConversations({ search: term, page, pageSize }, signal),
    enabled: !authLoading && !!user,
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
}

// The open conversation — faster poll (5–10s band) so an admin sees new customer
// messages promptly while a thread is open.
export function useAdminConversation(id: string | null) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'chat', 'conversation', id],
    queryFn: ({ signal }) => getAdminConversation(id as string, signal),
    enabled: !!id && !authLoading && !!user,
    refetchInterval: 8_000,
  });
}

export function useAdminReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: SendMessageBody }) =>
      adminReplyToConversation(id, body),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'chat', 'conversation', id] });
      void qc.invalidateQueries({ queryKey: ['admin', 'chat', 'conversations'] });
    },
  });
}

export function useMarkAdminConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markAdminConversationRead(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: ['admin', 'chat', 'conversation', id] });
      void qc.invalidateQueries({ queryKey: ['admin', 'chat', 'conversations'] });
    },
  });
}
