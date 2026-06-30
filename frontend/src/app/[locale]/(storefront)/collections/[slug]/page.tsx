import { setRequestLocale } from 'next-intl/server';

import { CollectionView } from '@/features/collection/components/collection-view';

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <CollectionView slug={slug} />;
}
