import {
  BadRequestException,
  ExecutionContext,
  createParamDecorator,
} from '@nestjs/common';

const SESSION_HEADER = 'x-cart-session';

/**
 * Reads the guest cart session id from the `X-Cart-Session` header. Used by the
 * merge endpoint, where an authenticated user supplies the guest session whose
 * items should be folded into their account cart. 400 when the header is absent.
 */
export const GuestSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const session = request.headers[SESSION_HEADER];
    if (typeof session !== 'string' || session.length === 0) {
      throw new BadRequestException('Missing X-Cart-Session header.');
    }
    return session;
  },
);
