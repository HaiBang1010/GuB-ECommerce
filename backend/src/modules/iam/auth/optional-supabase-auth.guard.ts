import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { extractBearerToken } from '../../../common/auth/bearer';
import { SupabaseJwtService } from './supabase-jwt.service';
import { UserService } from '../user/user.service';

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

/**
 * Like SupabaseAuthGuard, but the token is OPTIONAL: an anonymous request (no
 * Authorization header) passes through with no request.user — for endpoints that
 * serve both guests and signed-in users, e.g. the cart.
 *
 * A PRESENT token must still be valid: a malformed/expired token is rejected
 * (401) rather than silently downgraded to anonymous, so a broken session can't
 * masquerade as a guest.
 */
@Injectable()
export class OptionalSupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: SupabaseJwtService,
    private readonly users: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (typeof header !== 'string' || header.length === 0) {
      return true; // anonymous — proceed without a user
    }
    const token = extractBearerToken(header);
    const claims = await this.jwt.verify(token);
    const user = await this.users.upsertOnLogin(claims);
    request.user = { id: user.id, email: user.email, role: user.role };
    return true;
  }
}
