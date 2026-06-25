import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';

import { ConfirmationView } from '@/components/confirmation-view';

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // ConfirmationView reads Stripe's return_url query params via useSearchParams.
  return (
    <Suspense>
      <ConfirmationView orderId={id} />
    </Suspense>
  );
}
