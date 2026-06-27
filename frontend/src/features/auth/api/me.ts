import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Me = components['schemas']['MeResponseDto'];
export type Role = Me['role'];

// GET /me — the authenticated caller's account (id, email, role, basic profile).
// The frontend reads `role` from here as its single source of truth for admin UI;
// the backend RoleGuard on each admin endpoint is the real gate.
export function getMe(signal?: AbortSignal): Promise<Me> {
  return apiFetch<Me>('/me', { signal });
}
