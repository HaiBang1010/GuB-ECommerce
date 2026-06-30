'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  useAdminCollections,
  useArchiveCollection,
  useRestoreCollection,
} from '@/features/admin/collections/hooks/use-admin-collections';
import type { AdminCollection } from '@/features/admin/collections/api/collections';
import { CollectionForm } from '@/features/admin/collections/components/collection-form';
import { CollectionMembers } from '@/features/admin/collections/components/collection-members';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function AdminCollectionsView() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { data, isPending, isError } = useAdminCollections();
  const archive = useArchiveCollection();
  const restore = useRestoreCollection();

  const [editing, setEditing] = useState<AdminCollection | 'new' | null>(null);
  const [search, setSearch] = useState('');

  const collections = data ?? [];
  const nameOf = (c: AdminCollection) => (locale === 'vi' ? c.nameVi : c.nameEn);
  const term = search.trim().toLowerCase();
  const rows = collections.filter(
    (c) =>
      term === '' ||
      nameOf(c).toLowerCase().includes(term) ||
      c.slug.toLowerCase().includes(term),
  );

  function onArchive(c: AdminCollection) {
    if (!window.confirm(t('archiveCollectionConfirm'))) return;
    archive.mutate(c.id, {
      onSuccess: () => toast.success(t('collectionArchived')),
      onError: () => toast.error(t('collectionSaveError')),
    });
  }

  function onRestore(c: AdminCollection) {
    restore.mutate(c.id, {
      onSuccess: () => toast.success(t('collectionRestored')),
      onError: () => toast.error(t('collectionSaveError')),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('collectionsTitle')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchCollections')}
            className="w-full sm:w-64"
          />
          <Button onClick={() => setEditing('new')}>{t('newCollection')}</Button>
        </div>
      </div>

      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editing === 'new' ? t('newCollection') : t('editCollection')}
            </SheetTitle>
          </SheetHeader>
          {editing !== null ? (
            <>
              <CollectionForm
                key={editing === 'new' ? 'new' : editing.id}
                collection={editing === 'new' ? undefined : editing}
                onDone={() => setEditing(null)}
              />
              {/* Membership needs a persisted id → edit mode only. */}
              {editing !== 'new' ? (
                <CollectionMembers collectionId={editing.id} />
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t('collectionsError')}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noCollections')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3"
            >
              <div className="flex min-w-0 flex-col">
                <span className="font-medium">
                  {nameOf(c)}
                  {c.featuredOnHome ? (
                    <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-xs">
                      {t('featured')}
                    </span>
                  ) : null}
                  {c.archivedAt ? (
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({t('archived')})
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {c.slug}
                </span>
              </div>

              {c.featuredOnHome ? (
                <span className="text-muted-foreground text-xs">
                  {t('homeSortOrder')}: {c.homeSortOrder}
                </span>
              ) : null}

              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(c)}
                >
                  {t('edit')}
                </Button>
                {c.archivedAt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRestore(c)}
                  >
                    {t('restore')}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onArchive(c)}
                  >
                    {t('archive')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
