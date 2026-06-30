import { useQuery } from '@tanstack/react-query';

import { getBanners } from '@/features/banner/api/banners';

// Public storefront banners — NOT auth-gated (unlike the wallet/notifications hooks),
// since the home page renders them for guests too.
export function useBanners() {
  return useQuery({
    queryKey: ['banners'],
    queryFn: ({ signal }) => getBanners(signal),
  });
}
