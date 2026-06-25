import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/api/notifications';

// The current user's notifications + unread count. Polls modestly so the bell
// badge stays fresh without realtime (Supabase Realtime lands in Phase 6).
export function useNotifications() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['notifications'],
    queryFn: ({ signal }) => getNotifications(signal),
    enabled: !authLoading && !!user,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
