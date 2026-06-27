import { useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import { getAdminUser } from '@/lib/api/users';

// Admin: one customer's full detail. Gated to a logged-in user; the backend
// RoleGuard rejects non-admins (the admin shell also guards the UI).
export function useAdminUser(id: string) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: ({ signal }) => getAdminUser(id, signal),
    enabled: !authLoading && !!user,
  });
}
