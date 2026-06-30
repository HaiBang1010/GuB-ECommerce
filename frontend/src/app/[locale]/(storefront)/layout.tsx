import type { ReactNode } from 'react';

import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

// Storefront chrome: the shared Header + Footer wrap every public/customer page. The
// admin area lives in a sibling route group ((admin)) with its own shell and no
// storefront Header/Footer. Route groups are URL-transparent, so customer URLs are
// unchanged.
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
