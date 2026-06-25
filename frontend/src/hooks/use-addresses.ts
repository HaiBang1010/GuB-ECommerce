import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  createAddress,
  getAddresses,
  type CreateAddressInput,
} from '@/lib/api/addresses';

export function useAddresses() {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['addresses'],
    queryFn: ({ signal }) => getAddresses(signal),
    // Auth-required: only fetch once the session has settled AND a user exists,
    // so a guest's brief mount (before a guard redirect) never fires it.
    enabled: !authLoading && !!user,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAddressInput) => createAddress(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}
