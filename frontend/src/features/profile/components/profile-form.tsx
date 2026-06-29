'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useUpdateProfile } from '@/features/profile/hooks/use-profile';
import type { Profile, UpdateProfileInput } from '@/features/profile/api/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Native inputs are strings; the typed payload is built in onSubmit. Height/weight
// are integers (cm/kg), measurements allow one decimal (cm). All optional.
const INT = /^\d*$/;
const DECIMAL = /^\d*\.?\d*$/;

const schema = z.object({
  heightCm: z.string().regex(INT, 'number'),
  weightKg: z.string().regex(INT, 'number'),
  chest: z.string().regex(DECIMAL, 'number'),
  waist: z.string().regex(DECIMAL, 'number'),
  hip: z.string().regex(DECIMAL, 'number'),
  footLength: z.string().regex(DECIMAL, 'number'),
});
type FormValues = z.infer<typeof schema>;

type Measurements = NonNullable<UpdateProfileInput['measurements']>;
const MEASURE_KEYS = ['chest', 'waist', 'hip', 'footLength'] as const;

function toFormValues(profile: Profile): FormValues {
  const meas = (profile.measurements ?? {}) as Record<string, unknown>;
  const s = (v: unknown): string => (typeof v === 'number' ? String(v) : '');
  return {
    heightCm: profile.heightCm != null ? String(profile.heightCm) : '',
    weightKg: profile.weightKg != null ? String(profile.weightKg) : '',
    chest: s(meas.chest),
    waist: s(meas.waist),
    hip: s(meas.hip),
    footLength: s(meas.footLength),
  };
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations('profile');
  const update = useUpdateProfile();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(profile),
  });

  function fieldError(name: keyof FormValues): string | null {
    return form.formState.errors[name]?.message ? t('numberError') : null;
  }

  function onSubmit(values: FormValues) {
    const num = (v: string): number | undefined =>
      v.trim() === '' ? undefined : Number(v);

    const measurements: Measurements = {};
    for (const key of MEASURE_KEYS) {
      const n = num(values[key]);
      if (n !== undefined) measurements[key] = n;
    }

    const payload: UpdateProfileInput = {
      heightCm: num(values.heightCm),
      weightKg: num(values.weightKg),
      measurements,
    };

    update.mutate(payload, {
      onSuccess: () => toast.success(t('saved')),
      onError: () => toast.error(t('saveError')),
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('heightCm')} error={fieldError('heightCm')}>
          <Input inputMode="numeric" {...form.register('heightCm')} />
        </Field>
        <Field label={t('weightKg')} error={fieldError('weightKg')}>
          <Input inputMode="numeric" {...form.register('weightKg')} />
        </Field>
        <Field label={t('chest')} error={fieldError('chest')}>
          <Input inputMode="decimal" {...form.register('chest')} />
        </Field>
        <Field label={t('waist')} error={fieldError('waist')}>
          <Input inputMode="decimal" {...form.register('waist')} />
        </Field>
        <Field label={t('hip')} error={fieldError('hip')}>
          <Input inputMode="decimal" {...form.register('hip')} />
        </Field>
        <Field label={t('footLength')} error={fieldError('footLength')}>
          <Input inputMode="decimal" {...form.register('footLength')} />
        </Field>
      </div>

      <p className="text-muted-foreground text-xs">{t('hint')}</p>

      <Button type="submit" disabled={update.isPending} className="self-start">
        {t('save')}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
