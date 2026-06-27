import { setRequestLocale } from 'next-intl/server';

import { AdminUsersView } from '@/components/admin-users-view';

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <AdminUsersView userId={id} />;
}
