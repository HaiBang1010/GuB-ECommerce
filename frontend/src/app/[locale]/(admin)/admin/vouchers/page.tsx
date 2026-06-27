import { setRequestLocale } from 'next-intl/server';

import { AdminVouchersView } from '@/features/admin/vouchers/components/admin-vouchers-view';

export default async function AdminVouchersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminVouchersView />;
}
