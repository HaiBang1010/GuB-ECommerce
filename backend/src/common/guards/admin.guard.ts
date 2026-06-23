import {
  CanActivate,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

const ADMIN_SECRET_HEADER = 'x-admin-secret';

/**
 * Temporary gate for /admin/* routes.
 *
 * Compares the `x-admin-secret` request header against process.env.ADMIN_API_SECRET
 * in constant time. This is a PLACEHOLDER until the auth module ships a real JWT
 * role guard — the architecture mandates that admin endpoints are enforced on the
 * BACKEND, not merely hidden in the UI.
 *
 * Fails CLOSED: if ADMIN_API_SECRET is unset, every admin request is rejected with
 * 500 rather than allowed through.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ADMIN_API_SECRET;
    if (!expected) {
      throw new InternalServerErrorException(
        'Admin authentication is not configured.',
      );
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const provided = request.headers[ADMIN_SECRET_HEADER];

    // Absent, or (rarely) a repeated header → reject. Only a single string is valid.
    if (typeof provided !== 'string') {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    // Hash both sides to a fixed-length digest first: timingSafeEqual throws on a
    // length mismatch, and comparing raw values would leak the secret length via
    // timing. Equal-length digests avoid both.
    const providedDigest = createHash('sha256').update(provided).digest();
    const expectedDigest = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(providedDigest, expectedDigest)) {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    return true;
  }
}
