import { setRequestLocale } from 'next-intl/server';

import { AdminUsersListView } from '@/components/admin-users-list-view';

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminUsersListView />;
}
