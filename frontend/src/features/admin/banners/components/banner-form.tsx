'use client';

import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ImageOff } from 'lucide-react';

import {
  useCreateBanner,
  useUpdateBanner,
} from '@/features/admin/banners/hooks/use-admin-banners';
import type {
  Banner,
  CreateBannerBody,
} from '@/features/admin/banners/api/banners';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Form values are strings (native inputs) except the active checkbox; the typed API
// payload is built in onSubmit. imageUrl must be an absolute URL (re-checked server-side).
const schema = z.object({
  imageUrl: z.string().trim().min(1, 'required').max(2048).url('url'),
  linkUrl: z.string().trim().max(2048),
  title: z.string().trim().max(200),
  alt: z.string().trim().max(200),
  sortOrder: z.string().regex(/^\d*$/, 'number'),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function toFormValues(banner?: Banner): FormValues {
  return {
    imageUrl: banner?.imageUrl ?? '',
    linkUrl: banner?.linkUrl ?? '',
    title: banner?.title ?? '',
    alt: banner?.alt ?? '',
    sortOrder: banner != null ? String(banner.sortOrder) : '0',
    isActive: banner?.isActive ?? true,
  };
}

export function BannerForm({
  banner,
  onDone,
}: {
  banner?: Banner;
  onDone: () => void;
}) {
  const t = useTranslations('admin');
  const create = useCreateBanner();
  const update = useUpdateBanner();
  const isEdit = banner != null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(banner),
  });
  const imageUrl = form.watch('imageUrl');

  function fieldError(name: keyof FormValues): string | null {
    const msg = form.formState.errors[name]?.message;
    if (!msg) return null;
    if (msg === 'url') return t('urlError');
    if (msg === 'number') return t('numberError');
    return t('required');
  }

  function onSubmit(values: FormValues) {
    const text = (s: string): string | undefined => s.trim() || undefined;
    const payload: CreateBannerBody = {
      imageUrl: values.imageUrl.trim(),
      linkUrl: text(values.linkUrl),
      title: text(values.title),
      alt: text(values.alt),
      sortOrder: values.sortOrder.trim() === '' ? 0 : Number(values.sortOrder),
      isActive: values.isActive,
    };

    const onError = () => toast.error(t('bannerSaveError'));
    if (isEdit) {
      update.mutate(
        { id: banner.id, body: payload },
        {
          onSuccess: () => {
            toast.success(t('bannerUpdated'));
            onDone();
          },
          onError,
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          toast.success(t('bannerCreated'));
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
      <Field
        label={t('bannerImageUrl')}
        hint={t('bannerImageUrlHint')}
        error={fieldError('imageUrl')}
      >
        <Input {...form.register('imageUrl')} placeholder="https://…" />
      </Field>

      {/* Live preview of the entered URL (plain <img> — arbitrary host, onError fallback). */}
      <ImagePreview url={imageUrl} label={t('bannerPreview')} />

      <Field
        label={t('bannerLinkUrl')}
        hint={t('bannerLinkUrlHint')}
        error={fieldError('linkUrl')}
      >
        <Input {...form.register('linkUrl')} placeholder="/products" />
      </Field>

      <Field label={t('bannerTitleLabel')} error={fieldError('title')}>
        <Input {...form.register('title')} />
      </Field>

      <Field
        label={t('bannerAlt')}
        hint={t('bannerAltHint')}
        error={fieldError('alt')}
      >
        <Input {...form.register('alt')} />
      </Field>

      <Field label={t('bannerSortOrder')} error={fieldError('sortOrder')}>
        <Input inputMode="numeric" {...form.register('sortOrder')} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...form.register('isActive')} className="size-4" />
        {t('bannerActive')}
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
      <div className="bg-muted text-muted-foreground flex aspect-[16/5] w-full items-center justify-center overflow-hidden rounded-md border">
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
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
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
