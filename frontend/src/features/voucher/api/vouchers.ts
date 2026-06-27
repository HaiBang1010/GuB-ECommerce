import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type VoucherPreview = components['schemas']['VoucherPreviewResponseDto'];
export type VoucherError = components['schemas']['VoucherErrorDto'];
export type VoucherErrorCode = VoucherError['code'];
export type WalletVoucher = components['schemas']['WalletVoucherResponseDto'];

// Narrow an ApiError body to the structured voucher error so the checkout can map
// `code` → an i18n message (distinct from a stock / payment error).
export function isVoucherError(body: unknown): body is VoucherError {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { code?: unknown }).code === 'string' &&
    (body as { code: string }).code.startsWith('VOUCHER_')
  );
}

// POST /vouchers/preview — validate a code against the user's LIVE cart subtotal.
// Returns the discount/total preview (non-binding; re-validated at place-order).
export function previewVoucher(code: string): Promise<VoucherPreview> {
  return apiFetch<VoucherPreview>('/vouchers/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}

// GET /me/vouchers — the caller's usable wallet vouchers. (Customer wallet UI is
// deferred; the fetcher is here for a later slice.)
export function getWalletVouchers(
  signal?: AbortSignal,
): Promise<WalletVoucher[]> {
  return apiFetch<WalletVoucher[]>('/me/vouchers', { signal });
}
