'use client';

import { useTranslations } from 'next-intl';

import { useProfile } from '@/features/profile/hooks/use-profile';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { Skeleton } from '@/components/ui/skeleton';

// The customer profile page (/account/profile): edit height / weight / body
// measurements. These power the rule-based size suggestion on product pages.
export function ProfileView() {
  const t = useTranslations('profile');
  const { data, isPending, isError } = useProfile();

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>

      {isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive">{t('error')}</p>
      ) : (
        <ProfileForm profile={data} />
      )}
    </main>
  );
}
