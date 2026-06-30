import { setRequestLocale } from 'next-intl/server';

import { AdminBannersView } from '@/features/admin/banners/components/admin-banners-view';

export default async function AdminBannersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminBannersView />;
}
