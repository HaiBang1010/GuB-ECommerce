import { UnauthorizedException } from '@nestjs/common';

/**
 * Extract the token from an `Authorization: Bearer <jwt>` header value. Throws
 * UnauthorizedException when the header is absent or malformed. Shared by the
 * required (SupabaseAuthGuard) and optional (OptionalSupabaseAuthGuard) guards.
 */
export function extractBearerToken(
  header: string | string[] | undefined,
): string {
  if (typeof header !== 'string') {
    throw new UnauthorizedException('Missing Authorization header.');
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new UnauthorizedException('Malformed Authorization header.');
  }
  return token;
}
