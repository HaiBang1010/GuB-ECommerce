import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { SupabaseJwtService } from './supabase-jwt.service';
import { UserService } from '../user/user.service';

interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
}

/**
 * Authenticates a request from a Supabase access token in the
 * `Authorization: Bearer <jwt>` header: verifies the JWT against Supabase's
 * JWKS, upserts the local iam.User (first-login sync, §5.4), and attaches
 * { id, email, role } to request.user.
 *
 * This guard only proves WHO the caller is. Authorization (admin-only, ...) is a
 * SEPARATE concern handled by a RoleGuard in a later sub-slice — this slice
 * deliberately does NOT attach either guard onto any endpoint yet.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: SupabaseJwtService,
    private readonly users: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    const claims = await this.jwt.verify(token);
    const user = await this.users.upsertOnLogin(claims);
    request.user = { id: user.id, email: user.email, role: user.role };
    return true;
  }

  private extractBearerToken(header: string | string[] | undefined): string {
    if (typeof header !== 'string') {
      throw new UnauthorizedException('Missing Authorization header.');
    }
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Malformed Authorization header.');
    }
    return token;
  }
}
