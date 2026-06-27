import type { Role } from '@/features/auth/api/me';

// Convenience for hiding admin UI on the client. The backend RoleGuard is the real
// gate — a wrong client-side guess can never bypass it.
export function isAdmin(role: Role | null | undefined): boolean {
  return role === 'ADMIN';
}
