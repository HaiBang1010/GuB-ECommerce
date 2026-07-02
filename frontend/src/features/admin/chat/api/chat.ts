import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type AdminConversation =
  components['schemas']['AdminConversationResponseDto'];
export type PaginatedAdminConversations =
  components['schemas']['PaginatedAdminConversationsResponseDto'];
export type AdminChatThread = components['schemas']['ChatThreadResponseDto'];
export type AdminChatMessage = components['schemas']['ChatMessageResponseDto'];
export type SendMessageBody = components['schemas']['SendMessageDto'];
export type MarkReadResult = components['schemas']['MarkReadResponseDto'];

// GET /admin/chat/conversations — paginated, ?search by customer name/email.
export function getAdminConversations(
  params: { search?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
): Promise<PaginatedAdminConversations> {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return apiFetch<PaginatedAdminConversations>(
    `/admin/chat/conversations${q ? `?${q}` : ''}`,
    { signal },
  );
}

// GET /admin/chat/conversations/:id — conversation + message history.
export function getAdminConversation(
  id: string,
  signal?: AbortSignal,
): Promise<AdminChatThread> {
  return apiFetch<AdminChatThread>(
    `/admin/chat/conversations/${encodeURIComponent(id)}`,
    { signal },
  );
}

// POST /admin/chat/conversations/:id/messages — reply as admin (persisted first;
// the backend also broadcasts to the customer's live widget).
export function adminReplyToConversation(
  id: string,
  body: SendMessageBody,
): Promise<AdminChatMessage> {
  return apiFetch<AdminChatMessage>(
    `/admin/chat/conversations/${encodeURIComponent(id)}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

// POST /admin/chat/conversations/:id/read — mark the customer's messages read.
export function markAdminConversationRead(id: string): Promise<MarkReadResult> {
  return apiFetch<MarkReadResult>(
    `/admin/chat/conversations/${encodeURIComponent(id)}/read`,
    { method: 'POST' },
  );
}
