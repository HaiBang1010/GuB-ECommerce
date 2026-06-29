import { useQuery } from '@tanstack/react-query';

import { getWalletVouchers } from '@/features/voucher/api/vouchers';
import { useAuthStore } from '@/stores/auth.store';

// The current user's usable wallet vouchers (GET /me/vouchers). Auth-gated like
// useNotifications — only fires once the session has resolved to a logged-in user.
// No polling: a wallet changes rarely, the query refetches on focus/invalidation.
export function useWalletVouchers() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['wallet-vouchers'],
    queryFn: ({ signal }) => getWalletVouchers(signal),
    enabled: !authLoading && !!user,
  });
}
