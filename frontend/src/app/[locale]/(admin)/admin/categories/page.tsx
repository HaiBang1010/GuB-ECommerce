import { setRequestLocale } from 'next-intl/server';

import { AdminCategoriesView } from '@/features/admin/categories/components/admin-categories-view';

export default async function AdminCategoriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminCategoriesView />;
}
