import {
  BadRequestException,
  ExecutionContext,
  createParamDecorator,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CartOwner } from './cart.service';

// Guest carts are keyed by a client-generated id sent in this header (a header,
// not a cookie, to avoid cross-site cookie friction between Vercel and Render).
const SESSION_HEADER = 'x-cart-session';

interface CartRequest {
  user?: AuthenticatedUser;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Resolves the cart owner for the request: the authenticated user (populated by
 * OptionalSupabaseAuthGuard) if present, otherwise the guest session id from the
 * `X-Cart-Session` header. 400 when neither is provided.
 */
export const CurrentCartOwner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CartOwner => {
    const request = context.switchToHttp().getRequest<CartRequest>();
    if (request.user) {
      return { userId: request.user.id };
    }
    const session = request.headers[SESSION_HEADER];
    if (typeof session === 'string' && session.length > 0) {
      return { sessionId: session };
    }
    throw new BadRequestException(
      'Provide a Bearer token or an X-Cart-Session header.',
    );
  },
);
