import { useQuery } from '@tanstack/react-query';

import { getSizeSuggestion } from '@/features/product/api/size-suggestion';
import { useAuthStore } from '@/stores/auth.store';

// Rule-based size suggestion for a product. Auth-gated — never fires for guests on a
// public product page (the suggestion needs the caller's measurements).
export function useSizeSuggestion(slug: string) {
  const authLoading = useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['size-suggestion', slug],
    queryFn: ({ signal }) => getSizeSuggestion(slug, signal),
    enabled: !authLoading && !!user,
  });
}
