'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  useAdminCategories,
  useArchiveCategory,
  useRestoreCategory,
  useUpdateCategory,
} from '@/features/admin/categories/hooks/use-admin-categories';
import type {
  AdminCategory,
  SizeSystem,
} from '@/features/admin/categories/api/categories';
import { CategoryForm } from '@/features/admin/categories/components/category-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ApiError } from '@/lib/api/client';

const SIZE_SYSTEMS: SizeSystem[] = ['ALPHA_TOPS', 'ALPHA_BOTTOMS', 'EU_SHOES'];
const SIZE_SYSTEM_KEY: Record<SizeSystem, string> = {
  ALPHA_TOPS: 'sizeAlphaTops',
  ALPHA_BOTTOMS: 'sizeAlphaBottoms',
  EU_SHOES: 'sizeEuShoes',
};
const SELECT_CLASS =
  'h-8 rounded-md border bg-transparent px-2 text-xs shadow-sm';

// Depth-first order (parents before children) so the list reads as an indented tree.
function orderTree(
  categories: AdminCategory[],
): { cat: AdminCategory; depth: number }[] {
  const ids = new Set(categories.map((c) => c.id));
  const childrenByParent = new Map<string, AdminCategory[]>();
  for (const c of categories) {
    if (c.parentId !== null && ids.has(c.parentId)) {
      const arr = childrenByParent.get(c.parentId) ?? [];
      arr.push(c);
      childrenByParent.set(c.parentId, arr);
    }
  }
  const out: { cat: AdminCategory; depth: number }[] = [];
  const visit = (cat: AdminCategory, depth: number) => {
    out.push({ cat, depth });
    for (const child of childrenByParent.get(cat.id) ?? []) visit(child, depth + 1);
  };
  // Roots = no parent, or a parent that isn't in the set (defensive).
  for (const c of categories) {
    if (c.parentId === null || !ids.has(c.parentId)) visit(c, 0);
  }
  return out;
}

export function AdminCategoriesView() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { data, isPending, isError } = useAdminCategories();
  const update = useUpdateCategory();
  const archive = useArchiveCategory();
  const restore = useRestoreCategory();

  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);
  const [search, setSearch] = useState('');

  const categories = data ?? [];
  const nameOf = (c: AdminCategory) => (locale === 'vi' ? c.nameVi : c.nameEn);
  const parentName = (id: string | null) => {
    if (!id) return '';
    const p = categories.find((c) => c.id === id);
    return p ? nameOf(p) : '';
  };

  const term = search.trim().toLowerCase();
  const rows = orderTree(categories).filter(
    ({ cat }) =>
      term === '' ||
      nameOf(cat).toLowerCase().includes(term) ||
      cat.slug.toLowerCase().includes(term),
  );

  function onSetSizeSystem(cat: AdminCategory, value: string) {
    update.mutate(
      { id: cat.id, body: { sizeSystem: value === '' ? null : (value as SizeSystem) } },
      {
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t('categorySaveError')),
      },
    );
  }

  function onArchive(cat: AdminCategory) {
    const ok = window.confirm(
      t('archiveCategoryConfirm', {
        products: cat.productCount,
        subcategories: cat.childCount,
      }),
    );
    if (!ok) return;
    archive.mutate(cat.id, {
      onSuccess: () => toast.success(t('categoryArchived')),
      onError: () => toast.error(t('categorySaveError')),
    });
  }

  function onRestore(cat: AdminCategory) {
    restore.mutate(cat.id, {
      onSuccess: () => toast.success(t('categoryRestored')),
      onError: () => toast.error(t('categorySaveError')),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('categoriesTitle')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchCategories')}
            className="w-full sm:w-64"
          />
          <Button onClick={() => setEditing('new')}>{t('newCategory')}</Button>
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
              {editing === 'new' ? t('newCategory') : t('editCategory')}
            </SheetTitle>
          </SheetHeader>
          {editing !== null ? (
            <CategoryForm
              key={editing === 'new' ? 'new' : editing.id}
              category={editing === 'new' ? undefined : editing}
              categories={categories}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t('categoriesError')}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noCategories')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map(({ cat, depth }) => (
            <li
              key={cat.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3"
              style={{ marginLeft: depth * 16 }}
            >
              <div className="flex min-w-0 flex-col">
                <span className="font-medium">
                  {nameOf(cat)}
                  {cat.archivedAt ? (
                    <span className="text-muted-foreground ml-2 text-xs">
                      ({t('archived')})
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {cat.slug}
                  {cat.parentId
                    ? ` · ${t('parentCategory')}: ${parentName(cat.parentId)}`
                    : ''}
                </span>
              </div>

              <span className="text-muted-foreground text-xs">
                {t('productsCount', { count: cat.productCount })} ·{' '}
                {t('subcategoriesCount', { count: cat.childCount })}
              </span>

              <select
                className={SELECT_CLASS}
                value={cat.sizeSystem ?? ''}
                onChange={(e) => onSetSizeSystem(cat, e.target.value)}
                aria-label={t('sizeSystem')}
              >
                <option value="">{t('sizeSystemNone')}</option>
                {SIZE_SYSTEMS.map((s) => (
                  <option key={s} value={s}>
                    {t(SIZE_SYSTEM_KEY[s])}
                  </option>
                ))}
              </select>

              <div className="ml-auto flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(cat)}>
                  {t('edit')}
                </Button>
                {cat.archivedAt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRestore(cat)}
                  >
                    {t('restore')}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onArchive(cat)}
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
