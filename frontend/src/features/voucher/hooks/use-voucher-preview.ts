import { useMutation } from '@tanstack/react-query';

import { previewVoucher } from '@/features/voucher/api/vouchers';

// Validate + preview a voucher code against the user's live cart (mutation: it's a
// POST and fires on the "Apply" action, not on render).
export function useVoucherPreview() {
  return useMutation({ mutationFn: (code: string) => previewVoucher(code) });
}
