import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type NotificationItem = components['schemas']['NotificationResponseDto'];
export type NotificationList =
  components['schemas']['NotificationListResponseDto'];

// GET /notifications — the current user's notifications (newest first) + unread count.
export function getNotifications(
  signal?: AbortSignal,
): Promise<NotificationList> {
  return apiFetch<NotificationList>('/notifications', { signal });
}

// PATCH /notifications/:id/read — mark one read (owner-scoped on the backend).
export function markNotificationRead(id: string): Promise<NotificationItem> {
  return apiFetch<NotificationItem>(
    `/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
  );
}

// POST /notifications/read-all — mark all the user's notifications read.
export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/notifications/read-all', {
    method: 'POST',
  });
}
