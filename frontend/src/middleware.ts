import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from './i18n/routing';
import { refreshSession } from './lib/supabase/middleware';

const handleI18nRouting = createMiddleware(routing);

// Locale-prefixed routes that require a logged-in user. /admin only needs a
// session here (middleware can't see the role); the ADMIN check is the layout
// guard + the backend RoleGuard on every /admin/* API call.
const PROTECTED = /^\/(vi|en)\/(checkout|orders|admin)(\/|$)/;

export default async function middleware(request: NextRequest) {
  // 1) next-intl owns locale routing and the base response.
  const response = handleI18nRouting(request);

  // 2) Refresh the Supabase session, writing refreshed cookies onto that response.
  const user = await refreshSession(request, response);

  // 3) Gate protected routes — redirect guests to login.
  if (!user && PROTECTED.test(request.nextUrl.pathname)) {
    const locale = request.nextUrl.pathname.split('/')[1] || routing.defaultLocale;
    return NextResponse.redirect(
      new URL(`/${locale}/auth/login`, request.url),
    );
  }

  return response;
}

export const config = {
  // Run on all paths except API routes, Next internals, and static assets.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
