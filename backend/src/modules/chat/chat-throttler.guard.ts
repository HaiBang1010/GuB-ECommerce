import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';

// The subset of the request this guard reads for the rate-limit key.
interface TrackedRequest {
  user?: AuthenticatedUser;
  ip?: string;
}

/**
 * Rate-limits chat writes PER AUTHENTICATED USER (not per shared IP/NAT). The
 * SupabaseAuthGuard runs first and populates `request.user`, so the tracker key is
 * the caller's user id; it falls back to the request IP only as a safety net.
 */
@Injectable()
export class ChatThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: TrackedRequest): Promise<string> {
    return Promise.resolve(req.user?.id ?? req.ip ?? 'anonymous');
  }
}
