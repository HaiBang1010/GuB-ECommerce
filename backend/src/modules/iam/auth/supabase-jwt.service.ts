import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';

/**
 * The subset of Supabase access-token claims this app trusts.
 *
 * NOTE: the token's own `role`/`aud` are Postgres-level ("authenticated"), NOT
 * our application Role — the app Role lives in iam.User and is never taken from
 * the JWT. This type only carries identity, not authorization.
 */
export interface SupabaseClaims {
  sub: string;
  email: string;
  name: string | null;
}

// Supabase always issues user access tokens with this audience.
const SUPABASE_AUDIENCE = 'authenticated';

/**
 * Verifies Supabase access tokens against the project's JWKS endpoint
 * (asymmetric signing keys). The verification key never leaves Supabase; we only
 * ever fetch the public JWKS.
 *
 * Config is resolved LAZILY (like CloudinaryService) so the app boots without
 * SUPABASE_URL — only routes behind the auth guard need it. Fails CLOSED when
 * unset.
 */
@Injectable()
export class SupabaseJwtService {
  private keySet?: JWTVerifyGetKey;

  /**
   * Verify a Supabase access token and return the identity claims. Throws
   * UnauthorizedException on any signature/expiry/issuer/shape failure so the
   * guard can translate it straight into a 401.
   */
  async verify(token: string): Promise<SupabaseClaims> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.getKeySet(), {
        issuer: this.expectedIssuer(),
        audience: SUPABASE_AUDIENCE,
      }));
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
    return this.toClaims(payload);
  }

  // Expected `iss` for tokens from this Supabase project. Undefined when
  // SUPABASE_URL is unset → jose skips the issuer check (the guard never reaches
  // here in production because getKeySet() throws first).
  private expectedIssuer(): string | undefined {
    const url = process.env.SUPABASE_URL;
    return url ? `${url}/auth/v1` : undefined;
  }

  // Lazily build (and cache) the remote JWKS getter. Overridable in tests so the
  // verification path can run against a locally generated key pair without network.
  protected getKeySet(): JWTVerifyGetKey {
    if (!this.keySet) {
      const url = process.env.SUPABASE_URL;
      if (!url) {
        throw new InternalServerErrorException(
          'Supabase auth is not configured.',
        );
      }
      this.keySet = createRemoteJWKSet(
        new URL(`${url}/auth/v1/.well-known/jwks.json`),
      );
    }
    return this.keySet;
  }

  // Narrow the untyped JWT payload to the claims we require. A token without a
  // usable subject or email is treated as unauthenticated.
  private toClaims(payload: JWTPayload): SupabaseClaims {
    const { sub, email } = payload;
    if (typeof sub !== 'string' || sub.length === 0) {
      throw new UnauthorizedException('Token is missing a subject.');
    }
    if (typeof email !== 'string' || email.length === 0) {
      throw new UnauthorizedException('Token is missing an email.');
    }
    return { sub, email, name: this.extractName(payload) };
  }

  // Supabase puts the display name under user_metadata (name or full_name).
  private extractName(payload: JWTPayload): string | null {
    const metadata = payload.user_metadata;
    if (metadata !== null && typeof metadata === 'object') {
      const record = metadata as Record<string, unknown>;
      const name = record.name ?? record.full_name;
      if (typeof name === 'string' && name.length > 0) {
        return name;
      }
    }
    return null;
  }
}
