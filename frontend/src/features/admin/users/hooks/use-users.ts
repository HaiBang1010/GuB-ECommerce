import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import { getAdminUser, getAdminUsers } from '@/features/admin/users/api/users';

// Admin: a paginated page of customers with optional name/email search. Gated to a
// logged-in user; the backend RoleGuard rejects non-admins. keepPreviousData avoids
// a flash when paging/searching.
export function useAdminUsers(search?: string, page = 1, pageSize = 10) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  const term = search?.trim() ?? '';
  return useQuery({
    queryKey: ['admin', 'users', { search: term, page, pageSize }],
    queryFn: ({ signal }) =>
      getAdminUsers({ search: term, page, pageSize }, signal),
    enabled: !authLoading && !!user,
    placeholderData: keepPreviousData,
  });
}

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
