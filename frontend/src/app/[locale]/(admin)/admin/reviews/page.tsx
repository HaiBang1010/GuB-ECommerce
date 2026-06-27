import { setRequestLocale } from 'next-intl/server';

import { AdminReviewsView } from '@/features/admin/reviews/components/admin-reviews-view';

export default async function AdminReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminReviewsView />;
}
