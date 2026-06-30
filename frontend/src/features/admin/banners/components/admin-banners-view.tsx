'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImageOff } from 'lucide-react';

import {
  useAdminBanners,
  useArchiveBanner,
  useUpdateBanner,
} from '@/features/admin/banners/hooks/use-admin-banners';
import type { Banner } from '@/features/admin/banners/api/banners';
import { BannerForm } from '@/features/admin/banners/components/banner-form';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function AdminBannersView() {
  const t = useTranslations('admin');
  // null = sheet closed · 'new' = create form · a Banner = edit form.
  const [editing, setEditing] = useState<Banner | 'new' | null>(null);

  const { isPending, isError, data } = useAdminBanners();
  const archive = useArchiveBanner();
  const update = useUpdateBanner();

  function handleArchive(b: Banner) {
    if (!window.confirm(t('archiveBannerConfirm'))) return;
    archive.mutate(b.id, {
      onSuccess: () => toast.success(t('bannerArchived')),
      onError: () => toast.error(t('bannerSaveError')),
    });
  }

  function handleToggleActive(b: Banner, isActive: boolean) {
    update.mutate(
      { id: b.id, body: { isActive } },
      { onError: () => toast.error(t('bannerSaveError')) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('bannersTitle')}</h1>
        <Button onClick={() => setEditing('new')}>{t('newBanner')}</Button>
      </div>

      {/* New / Edit banner — slides in from the right. */}
      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editing === 'new' ? t('newBanner') : t('editBanner')}
            </SheetTitle>
          </SheetHeader>
          {editing !== null ? (
            <BannerForm
              key={editing === 'new' ? 'new' : editing.id}
              banner={editing === 'new' ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t('bannersError')}</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noBanners')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <Thumb banner={b} />

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm font-medium">
                  {b.title || b.imageUrl}
                </span>
                {b.linkUrl ? (
                  <span className="text-muted-foreground truncate text-xs">
                    → {b.linkUrl}
                  </span>
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {t('bannerSortOrder')}: {b.sortOrder}
                </span>
              </div>

              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={b.isActive}
                  onChange={(e) => handleToggleActive(b, e.target.checked)}
                  className="size-4"
                />
                {t('bannerActive')}
              </label>

              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(b)}>
                  {t('edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleArchive(b)}
                >
                  {t('archive')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Small thumbnail with a graceful fallback when the URL is empty / fails to load.
function Thumb({ banner }: { banner: Banner }) {
  const [errored, setErrored] = useState(false);
  const broken = errored || !banner.imageUrl;
  return (
    <div className="bg-muted text-muted-foreground flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded">
      {broken ? (
        <ImageOff className="size-4 opacity-50" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.imageUrl}
          alt={banner.alt ?? banner.title ?? ''}
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
