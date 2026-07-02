import { setRequestLocale } from 'next-intl/server';

import { AdminChatView } from '@/features/admin/chat/components/admin-chat-view';

export default async function AdminChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AdminChatView />;
}
