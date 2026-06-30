import { setRequestLocale } from 'next-intl/server';

import { AdminCollectionsView } from '@/features/admin/collections/components/admin-collections-view';

export default async function AdminCollectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminCollectionsView />;
}
