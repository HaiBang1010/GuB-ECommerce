import { CustomDecorator, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Declares which application Roles may access a handler or controller. Enforced
 * by RolesGuard, which reads this metadata. Without it, RolesGuard imposes no
 * restriction.
 */
export const Roles = (...roles: Role[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
