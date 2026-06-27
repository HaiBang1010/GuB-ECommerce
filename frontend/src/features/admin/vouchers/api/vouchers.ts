import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Voucher = components['schemas']['VoucherResponseDto'];
export type PaginatedVouchers =
  components['schemas']['PaginatedVouchersResponseDto'];
export type CreateVoucherBody = components['schemas']['CreateVoucherDto'];
export type UpdateVoucherBody = components['schemas']['UpdateVoucherDto'];
export type GrantedUser = components['schemas']['GrantedUserResponseDto'];

// GET /admin/vouchers — paginated, optional ?search by code. ADMIN-only on the backend.
export function getAdminVouchers(
  params: { search?: string; page?: number; pageSize?: number } = {},
  signal?: AbortSignal,
): Promise<PaginatedVouchers> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const q = qs.toString();
  return apiFetch<PaginatedVouchers>(`/admin/vouchers${q ? `?${q}` : ''}`, {
    signal,
  });
}

// POST /admin/vouchers — create.
export function createVoucher(body: CreateVoucherBody): Promise<Voucher> {
  return apiFetch<Voucher>('/admin/vouchers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// PATCH /admin/vouchers/:id — update.
export function updateVoucher(
  id: string,
  body: UpdateVoucherBody,
): Promise<Voucher> {
  return apiFetch<Voucher>(`/admin/vouchers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// DELETE /admin/vouchers/:id — archive (soft delete).
export function archiveVoucher(id: string): Promise<Voucher> {
  return apiFetch<Voucher>(`/admin/vouchers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// POST /admin/vouchers/:id/grant — grant a wallet-only voucher to a user by email.
export function grantVoucher(id: string, email: string): Promise<Voucher> {
  return apiFetch<Voucher>(`/admin/vouchers/${encodeURIComponent(id)}/grant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

// GET /admin/vouchers/:id/grants — users this voucher was granted to (+ used state).
export function getVoucherGrants(
  id: string,
  signal?: AbortSignal,
): Promise<GrantedUser[]> {
  return apiFetch<GrantedUser[]>(
    `/admin/vouchers/${encodeURIComponent(id)}/grants`,
    { signal },
  );
}
