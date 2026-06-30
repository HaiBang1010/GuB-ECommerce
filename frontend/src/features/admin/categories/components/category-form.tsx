'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  useCreateCategory,
  useUpdateCategory,
} from '@/features/admin/categories/hooks/use-admin-categories';
import type {
  AdminCategory,
  CreateCategoryBody,
  SizeSystem,
  UpdateCategoryBody,
} from '@/features/admin/categories/api/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SIZE_SYSTEMS: SizeSystem[] = ['ALPHA_TOPS', 'ALPHA_BOTTOMS', 'EU_SHOES'];
const SELECT_CLASS =
  'h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-sm';

const schema = z.object({
  nameVi: z.string().trim().min(1, 'required').max(120),
  nameEn: z.string().trim().min(1, 'required').max(120),
  slug: z.string().trim().regex(SLUG_PATTERN, 'slug'),
  parentId: z.string(), // '' = root
  sizeSystem: z.string(), // '' = none
});
type FormValues = z.infer<typeof schema>;

// Self + all descendants — invalid parent choices (would form a cycle). The backend
// re-guards, but excluding them from the dropdown is clearer UX.
function blockedParentIds(
  categories: AdminCategory[],
  rootId: string,
): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (c.parentId) {
      const arr = childrenByParent.get(c.parentId) ?? [];
      arr.push(c.id);
      childrenByParent.set(c.parentId, arr);
    }
  }
  const blocked = new Set<string>([rootId]);
  const stack = [rootId];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    for (const child of childrenByParent.get(id) ?? []) {
      if (!blocked.has(child)) {
        blocked.add(child);
        stack.push(child);
      }
    }
  }
  return blocked;
}

export function CategoryForm({
  category,
  categories,
  onDone,
}: {
  category?: AdminCategory;
  categories: AdminCategory[];
  onDone: () => void;
}) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const isEdit = category != null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nameVi: category?.nameVi ?? '',
      nameEn: category?.nameEn ?? '',
      slug: category?.slug ?? '',
      parentId: category?.parentId ?? '',
      sizeSystem: category?.sizeSystem ?? '',
    },
  });

  const blocked = category
    ? blockedParentIds(categories, category.id)
    : new Set<string>();
  const parentOptions = categories.filter(
    (c) => c.archivedAt === null && !blocked.has(c.id),
  );

  function fieldError(name: keyof FormValues): string | null {
    const msg = form.formState.errors[name]?.message;
    if (!msg) return null;
    return msg === 'slug' ? t('slugError') : t('required');
  }

  function onError(err: unknown) {
    toast.error(err instanceof ApiError ? err.message : t('categorySaveError'));
  }

  function onSubmit(values: FormValues) {
    const sizeSystem =
      values.sizeSystem === '' ? null : (values.sizeSystem as SizeSystem);

    if (isEdit) {
      const body: UpdateCategoryBody = {
        nameVi: values.nameVi.trim(),
        nameEn: values.nameEn.trim(),
        slug: values.slug.trim(),
        parentId: values.parentId === '' ? null : values.parentId,
        sizeSystem,
      };
      update.mutate(
        { id: category.id, body },
        {
          onSuccess: () => {
            toast.success(t('categoryUpdated'));
            onDone();
          },
          onError,
        },
      );
    } else {
      const body: CreateCategoryBody = {
        nameVi: values.nameVi.trim(),
        nameEn: values.nameEn.trim(),
        slug: values.slug.trim(),
        ...(values.parentId === '' ? {} : { parentId: values.parentId }),
        sizeSystem,
      };
      create.mutate(body, {
        onSuccess: () => {
          toast.success(t('categoryCreated'));
          onDone();
        },
        onError,
      });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-1 flex-col gap-3"
      noValidate
    >
      <div className="grid gap-3">
        <Field label={t('titleVi')} error={fieldError('nameVi')}>
          <Input {...form.register('nameVi')} />
        </Field>
        <Field label={t('titleEn')} error={fieldError('nameEn')}>
          <Input {...form.register('nameEn')} />
        </Field>
        <Field
          label="Slug"
          hint={t('slugHint')}
          error={fieldError('slug')}
        >
          <Input {...form.register('slug')} />
        </Field>

        <Field label={t('parentCategory')} error={fieldError('parentId')}>
          <select className={SELECT_CLASS} {...form.register('parentId')}>
            <option value="">{t('rootCategory')}</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {locale === 'vi' ? c.nameVi : c.nameEn}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('sizeSystem')} error={fieldError('sizeSystem')}>
          <select className={SELECT_CLASS} {...form.register('sizeSystem')}>
            <option value="">{t('sizeSystemNone')}</option>
            {SIZE_SYSTEMS.map((s) => (
              <option key={s} value={s}>
                {t(SIZE_SYSTEM_KEY[s])}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-2 flex gap-2">
        <Button type="submit" disabled={pending}>
          {t('save')}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}

const SIZE_SYSTEM_KEY: Record<SizeSystem, string> = {
  ALPHA_TOPS: 'sizeAlphaTops',
  ALPHA_BOTTOMS: 'sizeAlphaBottoms',
  EU_SHOES: 'sizeEuShoes',
};

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
