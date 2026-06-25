import type { ReactNode } from 'react';

import { Header } from '@/components/header';

// Storefront chrome: the shared Header sits above every public/customer page. The
// admin area lives in a sibling route group ((admin)) with its own shell and no
// storefront Header. Route groups are URL-transparent, so customer URLs are unchanged.
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
