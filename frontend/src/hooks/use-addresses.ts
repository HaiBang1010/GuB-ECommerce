import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/stores/auth.store';
import {
  createAddress,
  getAddresses,
  type CreateAddressInput,
} from '@/lib/api/addresses';

export function useAddresses() {
  const authLoading = useAuthStore((s) => s.isLoading);
  return useQuery({
    queryKey: ['addresses'],
    queryFn: getAddresses,
    enabled: !authLoading,
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAddressInput) => createAddress(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}
