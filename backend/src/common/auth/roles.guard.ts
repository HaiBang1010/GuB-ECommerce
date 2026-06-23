import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from './authenticated-user';
import { ROLES_KEY } from './roles.decorator';

/**
 * Authorization guard: enforces @Roles(...) metadata against request.user.role.
 *
 * MUST run AFTER an authentication guard that populates request.user — list it
 * second, e.g. `@UseGuards(SupabaseAuthGuard, RolesGuard)`. When a handler has
 * no @Roles metadata it imposes no restriction (authentication alone decides).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined || required.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions.');
    }
    return true;
  }
}
