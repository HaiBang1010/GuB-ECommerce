'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImageOff } from 'lucide-react';

import {
  useCreateCollection,
  useUpdateCollection,
} from '@/features/admin/collections/hooks/use-admin-collections';
import type {
  AdminCollection,
  CreateCollectionBody,
  UpdateCollectionBody,
} from '@/features/admin/collections/api/collections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Form values are strings (native inputs) except the featured checkbox; the typed API
// payload is built in onSubmit. imageUrl is optional ('' = none) but must be an absolute
// URL when present (re-checked server-side). validFrom < validTo is refined here too.
const schema = z
  .object({
    nameVi: z.string().trim().min(1, 'required').max(120),
    nameEn: z.string().trim().min(1, 'required').max(120),
    slug: z.string().trim().regex(SLUG_PATTERN, 'slug'),
    imageUrl: z
      .string()
      .trim()
      .max(2048)
      .refine((v) => v === '' || z.string().url().safeParse(v).success, 'url'),
    featuredOnHome: z.boolean(),
    homeSortOrder: z.string().regex(/^\d*$/, 'number'),
    validFrom: z.string(),
    validTo: z.string(),
  })
  .refine(
    (v) =>
      !v.validFrom ||
      !v.validTo ||
      new Date(v.validFrom) < new Date(v.validTo),
    { path: ['validTo'], message: 'window' },
  );

type FormValues = z.infer<typeof schema>;

function toFormValues(c?: AdminCollection): FormValues {
  return {
    nameVi: c?.nameVi ?? '',
    nameEn: c?.nameEn ?? '',
    slug: c?.slug ?? '',
    imageUrl: c?.imageUrl ?? '',
    featuredOnHome: c?.featuredOnHome ?? false,
    homeSortOrder: c != null ? String(c.homeSortOrder) : '0',
    // ISO → the 'YYYY-MM-DDTHH:mm' a datetime-local input expects.
    validFrom: c?.validFrom ? c.validFrom.slice(0, 16) : '',
    validTo: c?.validTo ? c.validTo.slice(0, 16) : '',
  };
}

export function CollectionForm({
  collection,
  onDone,
}: {
  collection?: AdminCollection;
  onDone: () => void;
}) {
  const t = useTranslations('admin');
  const create = useCreateCollection();
  const update = useUpdateCollection();
  const isEdit = collection != null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(collection),
  });
  const imageUrl = form.watch('imageUrl');

  function fieldError(name: keyof FormValues): string | null {
    const msg = form.formState.errors[name]?.message;
    if (!msg) return null;
    if (msg === 'slug') return t('slugError');
    if (msg === 'url') return t('urlError');
    if (msg === 'number') return t('numberError');
    if (msg === 'window') return t('windowError');
    return t('required');
  }

  function onError(err: unknown) {
    toast.error(
      err instanceof ApiError ? err.message : t('collectionSaveError'),
    );
  }

  function onSubmit(values: FormValues) {
    const trimmedImageUrl = values.imageUrl.trim();
    const homeSortOrder =
      values.homeSortOrder.trim() === '' ? 0 : Number(values.homeSortOrder);
    const validFrom = values.validFrom
      ? new Date(values.validFrom).toISOString()
      : undefined;
    const validTo = values.validTo
      ? new Date(values.validTo).toISOString()
      : undefined;

    if (isEdit) {
      const body: UpdateCollectionBody = {
        nameVi: values.nameVi.trim(),
        nameEn: values.nameEn.trim(),
        slug: values.slug.trim(),
        imageUrl: trimmedImageUrl === '' ? null : trimmedImageUrl,
        featuredOnHome: values.featuredOnHome,
        homeSortOrder,
        validFrom: validFrom ?? null,
        validTo: validTo ?? null,
      };
      update.mutate(
        { id: collection.id, body },
        {
          onSuccess: () => {
            toast.success(t('collectionUpdated'));
            onDone();
          },
          onError,
        },
      );
    } else {
      const body: CreateCollectionBody = {
        nameVi: values.nameVi.trim(),
        nameEn: values.nameEn.trim(),
        slug: values.slug.trim(),
        ...(trimmedImageUrl === '' ? {} : { imageUrl: trimmedImageUrl }),
        featuredOnHome: values.featuredOnHome,
        homeSortOrder,
        ...(validFrom ? { validFrom } : {}),
        ...(validTo ? { validTo } : {}),
      };
      create.mutate(body, {
        onSuccess: () => {
          toast.success(t('collectionCreated'));
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
      className="flex flex-col gap-3"
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Bilingual name (admin form has two inputs per content field). */}
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
          className="sm:col-span-2"
        >
          <Input {...form.register('slug')} />
        </Field>

        <Field
          label={t('collectionImageUrl')}
          hint={t('collectionImageUrlHint')}
          error={fieldError('imageUrl')}
          className="sm:col-span-2"
        >
          <Input {...form.register('imageUrl')} placeholder="https://…" />
        </Field>
      </div>

      {/* Live preview of the entered URL (plain <img> — arbitrary host, onError fallback). */}
      <ImagePreview url={imageUrl} label={t('collectionPreview')} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('validFrom')} error={fieldError('validFrom')}>
          <Input type="datetime-local" {...form.register('validFrom')} />
        </Field>
        <Field label={t('validTo')} error={fieldError('validTo')}>
          <Input type="datetime-local" {...form.register('validTo')} />
        </Field>
        <Field
          label={t('homeSortOrder')}
          hint={t('homeSortOrderHint')}
          error={fieldError('homeSortOrder')}
        >
          <Input inputMode="numeric" {...form.register('homeSortOrder')} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          {...form.register('featuredOnHome')}
          className="size-4"
        />
        {t('featuredOnHome')}
      </label>

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

function ImagePreview({ url, label }: { url: string; label: string }) {
  const [errored, setErrored] = useState(false);
  const trimmed = url.trim();
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="bg-muted text-muted-foreground flex aspect-video w-40 items-center justify-center overflow-hidden rounded-md border">
        {trimmed && !errored ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={trimmed}
            alt=""
            onError={() => setErrored(true)}
            onLoad={() => setErrored(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageOff className="size-6 opacity-50" />
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
