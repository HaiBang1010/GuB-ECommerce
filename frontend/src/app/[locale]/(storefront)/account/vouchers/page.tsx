import { setRequestLocale } from 'next-intl/server';

import { WalletView } from '@/features/voucher/components/wallet-view';

export default async function VouchersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <WalletView />;
}
