'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

import {
  useAddCollectionProducts,
  useCollectionProductIds,
  useRemoveCollectionProducts,
} from '@/features/admin/collections/hooks/use-admin-collections';
import { useProducts } from '@/features/product/hooks/use-products';
import type { Product } from '@/features/product/api/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// Product membership (n-n) manager, shown only in edit mode (needs a collection id).
// Member ids come from the collection endpoint; names are resolved against the active
// product list (small catalog → one unpaginated fetch). The add picker only lists
// products once the admin types, to avoid dumping the whole catalog.
export function CollectionMembers({ collectionId }: { collectionId: string }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const memberIdsQuery = useCollectionProductIds(collectionId);
  const productsQuery = useProducts();
  const add = useAddCollectionProducts(collectionId);
  const remove = useRemoveCollectionProducts(collectionId);
  const [search, setSearch] = useState('');

  const products = productsQuery.data ?? [];
  const memberIds = new Set(memberIdsQuery.data ?? []);
  const nameOf = (p: Product) => (locale === 'vi' ? p.nameVi : p.nameEn);

  const members = products.filter((p) => memberIds.has(p.id));
  const term = search.trim().toLowerCase();
  const candidates = products.filter(
    (p) =>
      !memberIds.has(p.id) &&
      (term === '' ||
        nameOf(p).toLowerCase().includes(term) ||
        p.slug.toLowerCase().includes(term)),
  );

  const busy = add.isPending || remove.isPending;
  const loading = memberIdsQuery.isPending || productsQuery.isPending;

  function onAdd(p: Product) {
    add.mutate([p.id], {
      onError: () => toast.error(t('collectionSaveError')),
    });
  }
  function onRemove(p: Product) {
    remove.mutate([p.id], {
      onError: () => toast.error(t('collectionSaveError')),
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-semibold">{t('collectionMembers')}</h3>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('noMembers')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {members.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">{nameOf(p)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => onRemove(p)}
                    aria-label={t('removeProduct')}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('addProduct')}
          />
          {term !== '' ? (
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {candidates.length === 0 ? (
                <li className="text-muted-foreground text-sm">
                  {t('noProductsFound')}
                </li>
              ) : (
                candidates.slice(0, 20).map((p) => (
                  <li
                    key={p.id}
                    className="hover:bg-muted/60 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    <span className="min-w-0 truncate">{nameOf(p)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => onAdd(p)}
                      aria-label={t('addProduct')}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
