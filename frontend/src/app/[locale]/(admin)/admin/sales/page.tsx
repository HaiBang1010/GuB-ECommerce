import { setRequestLocale } from 'next-intl/server';

import { AdminSalesView } from '@/features/admin/sales/components/admin-sales-view';

export default async function AdminSalesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminSalesView />;
}
