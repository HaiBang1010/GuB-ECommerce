import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type ChatThread = components['schemas']['ChatThreadResponseDto'];
export type ChatMessage = components['schemas']['ChatMessageResponseDto'];
export type MarkReadResult = components['schemas']['MarkReadResponseDto'];

// GET /me/chat — get (or create) my conversation + its message history (ascending).
export function getChatThread(signal?: AbortSignal): Promise<ChatThread> {
  return apiFetch<ChatThread>('/me/chat', { signal });
}

// POST /me/chat/messages — send a message to support (persisted first).
export function sendChatMessage(body: string): Promise<ChatMessage> {
  return apiFetch<ChatMessage>('/me/chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

// POST /me/chat/read — mark the incoming (admin) messages in my conversation read.
export function markChatRead(): Promise<MarkReadResult> {
  return apiFetch<MarkReadResult>('/me/chat/read', { method: 'POST' });
}
