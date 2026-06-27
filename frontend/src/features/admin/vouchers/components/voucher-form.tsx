'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  useCreateVoucher,
  useUpdateVoucher,
} from '@/features/admin/vouchers/hooks/use-admin-vouchers';
import type {
  CreateVoucherBody,
  Voucher,
} from '@/features/admin/vouchers/api/vouchers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Form values are all strings (native inputs/selects); the typed API payload is
// built in onSubmit. Numeric fields accept digits only; the cross-field rules
// (PERCENT <= 100, validFrom < validTo) are refined here AND re-checked server-side.
const schema = z
  .object({
    code: z.string().trim().min(1, 'required').max(50),
    type: z.enum(['PERCENT', 'FIXED']),
    isPublic: z.enum(['true', 'false']),
    value: z.string().regex(/^\d+$/, 'required'),
    minOrderCents: z.string().regex(/^\d*$/, 'number'),
    maxDiscountCents: z.string().regex(/^\d*$/, 'number'),
    validFrom: z.string(),
    validTo: z.string(),
    usageLimit: z.string().regex(/^\d*$/, 'number'),
    perUserLimit: z.string().regex(/^\d*$/, 'number'),
  })
  .refine((v) => Number(v.value) >= 1, { path: ['value'], message: 'required' })
  .refine((v) => v.type !== 'PERCENT' || Number(v.value) <= 100, {
    path: ['value'],
    message: 'percent',
  })
  .refine(
    (v) =>
      !v.validFrom ||
      !v.validTo ||
      new Date(v.validFrom) < new Date(v.validTo),
    { path: ['validTo'], message: 'window' },
  );

type FormValues = z.infer<typeof schema>;

function toFormValues(voucher?: Voucher): FormValues {
  return {
    code: voucher?.code ?? '',
    type: voucher?.type ?? 'PERCENT',
    isPublic: (voucher?.isPublic ?? true) ? 'true' : 'false',
    value: voucher != null ? String(voucher.value) : '',
    minOrderCents: voucher?.minOrderCents != null ? String(voucher.minOrderCents) : '',
    maxDiscountCents:
      voucher?.maxDiscountCents != null ? String(voucher.maxDiscountCents) : '',
    // ISO → the 'YYYY-MM-DDTHH:mm' a datetime-local input expects.
    validFrom: voucher?.validFrom ? voucher.validFrom.slice(0, 16) : '',
    validTo: voucher?.validTo ? voucher.validTo.slice(0, 16) : '',
    usageLimit: voucher?.usageLimit != null ? String(voucher.usageLimit) : '',
    perUserLimit: voucher?.perUserLimit != null ? String(voucher.perUserLimit) : '',
  };
}

const SELECT_CLASS =
  'h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-sm';

export function VoucherForm({
  voucher,
  onDone,
}: {
  voucher?: Voucher;
  onDone: () => void;
}) {
  const t = useTranslations('admin');
  const create = useCreateVoucher();
  const update = useUpdateVoucher();
  const isEdit = voucher != null;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(voucher),
  });
  const type = form.watch('type');

  function fieldError(name: keyof FormValues): string | null {
    const msg = form.formState.errors[name]?.message;
    if (!msg) return null;
    if (msg === 'percent') return t('valuePercentError');
    if (msg === 'window') return t('windowError');
    if (msg === 'number') return t('numberError');
    return t('required');
  }

  function onSubmit(values: FormValues) {
    const num = (s: string): number | undefined =>
      s.trim() === '' ? undefined : Number(s);
    const payload: CreateVoucherBody = {
      code: values.code.trim(),
      type: values.type,
      isPublic: values.isPublic === 'true',
      value: Number(values.value),
      minOrderCents: num(values.minOrderCents),
      maxDiscountCents: num(values.maxDiscountCents),
      validFrom: values.validFrom
        ? new Date(values.validFrom).toISOString()
        : undefined,
      validTo: values.validTo
        ? new Date(values.validTo).toISOString()
        : undefined,
      usageLimit: num(values.usageLimit),
      perUserLimit: num(values.perUserLimit),
    };

    const onError = () => toast.error(t('saveError'));
    if (isEdit) {
      update.mutate(
        { id: voucher.id, body: payload },
        {
          onSuccess: () => {
            toast.success(t('voucherUpdated'));
            onDone();
          },
          onError,
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          toast.success(t('voucherCreated'));
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
      className="flex flex-col gap-3 rounded-md border p-4"
      noValidate
    >
      <h2 className="text-lg font-medium">
        {isEdit ? t('editVoucher') : t('newVoucher')}
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('code')} error={fieldError('code')}>
          <Input {...form.register('code')} />
        </Field>

        <Field label={t('visibility')} error={fieldError('isPublic')}>
          <select className={SELECT_CLASS} {...form.register('isPublic')}>
            <option value="true">{t('public')}</option>
            <option value="false">{t('walletOnly')}</option>
          </select>
        </Field>

        <Field label={t('type')} error={fieldError('type')}>
          <select className={SELECT_CLASS} {...form.register('type')}>
            <option value="PERCENT">{t('typePercent')}</option>
            <option value="FIXED">{t('typeFixed')}</option>
          </select>
        </Field>

        <Field
          label={t('value')}
          hint={type === 'PERCENT' ? t('valuePercentHint') : t('valueFixedHint')}
          error={fieldError('value')}
        >
          <Input inputMode="numeric" {...form.register('value')} />
        </Field>

        <Field
          label={t('minOrder')}
          hint={t('centsHint')}
          error={fieldError('minOrderCents')}
        >
          <Input inputMode="numeric" {...form.register('minOrderCents')} />
        </Field>

        <Field
          label={t('maxDiscount')}
          hint={t('centsHint')}
          error={fieldError('maxDiscountCents')}
        >
          <Input inputMode="numeric" {...form.register('maxDiscountCents')} />
        </Field>

        <Field label={t('validFrom')} error={fieldError('validFrom')}>
          <Input type="datetime-local" {...form.register('validFrom')} />
        </Field>

        <Field label={t('validTo')} error={fieldError('validTo')}>
          <Input type="datetime-local" {...form.register('validTo')} />
        </Field>

        <Field label={t('usageLimit')} error={fieldError('usageLimit')}>
          <Input inputMode="numeric" {...form.register('usageLimit')} />
        </Field>

        <Field label={t('perUserLimit')} error={fieldError('perUserLimit')}>
          <Input inputMode="numeric" {...form.register('perUserLimit')} />
        </Field>
      </div>

      <div className="flex gap-2">
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
