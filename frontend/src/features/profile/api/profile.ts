import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Profile = components['schemas']['ProfileResponseDto'];
export type UpdateProfileInput = components['schemas']['UpdateProfileDto'];

// GET /me/profile — the caller's own body profile (height/weight/measurements).
export function getProfile(signal?: AbortSignal): Promise<Profile> {
  return apiFetch<Profile>('/me/profile', { signal });
}

// PATCH /me/profile — partial update; only the provided fields are written.
export function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  return apiFetch<Profile>('/me/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
