import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedUser } from './authenticated-user';

/**
 * Injects `request.user` (populated by SupabaseAuthGuard) into a handler
 * parameter. Returns undefined on routes without an auth guard, so handlers that
 * require a user must also be guarded.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    return request.user;
  },
);
