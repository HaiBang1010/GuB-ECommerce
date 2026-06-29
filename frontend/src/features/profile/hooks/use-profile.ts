import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getProfile, updateProfile } from '@/features/profile/api/profile';
import { useAuthStore } from '@/stores/auth.store';

// The current user's profile (GET /me/profile). Auth-gated like useWalletVouchers —
// only fires once the session has resolved to a logged-in user.
export function useProfile() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['profile'],
    queryFn: ({ signal }) => getProfile(signal),
    enabled: !authLoading && !!user,
  });
}

// Saves the profile, then refreshes it and any size suggestions (which read the
// updated measurements).
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['size-suggestion'] });
    },
  });
}
