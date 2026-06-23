import { Role } from '@prisma/client';

/**
 * The authenticated principal attached to `request.user` by SupabaseAuthGuard.
 *
 * Lives in `common` (shared kernel) so guards and decorators can depend on this
 * contract without importing a feature module. `role` is the application Role
 * from iam.User — never taken from the JWT.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}
