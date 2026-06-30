'use client';

import { useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { useWalletVouchers } from '@/features/voucher/hooks/use-wallet-vouchers';
import type { WalletVoucher } from '@/features/voucher/api/vouchers';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPriceCents } from '@/lib/money';
import { formatDate } from '@/lib/datetime';

// The customer voucher wallet (/account/vouchers): the still-usable vouchers
// granted to / available for this user. Read-only — applying a voucher happens at
// checkout (features/voucher preview); here we only display + let the user copy a
// code to paste there.
export function WalletView() {
  const t = useTranslations('wallet');
  const { data, isPending, isError } = useWalletVouchers();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>

      {isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : isError || !data ? (
        <p className="text-destructive">{t('error')}</p>
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((v) => (
            <WalletVoucherCard key={v.id} voucher={v} />
          ))}
        </ul>
      )}
    </main>
  );
}

function WalletVoucherCard({ voucher: v }: { voucher: WalletVoucher }) {
  const t = useTranslations('wallet');
  const locale = useLocale();

  const title = (locale === 'vi' ? v.titleVi : v.titleEn) ?? v.code;
  const description = locale === 'vi' ? v.descriptionVi : v.descriptionEn;
  const discountLabel =
    v.type === 'PERCENT'
      ? t('discountPercent', { value: v.value })
      : t('discountFixed', { amount: formatPriceCents(v.value) });
  // Per-user redemptions remaining (the wallet DTO carries this user's usedCount);
  // null perUserLimit = no per-user cap.
  const usesLeft =
    v.perUserLimit != null
      ? t('usesLeft', { count: Math.max(0, v.perUserLimit - v.userUsedCount) })
      : t('unlimited');
  // The deadline shown: the per-user expiresAt (e.g. birthday voucher = grant + 30d)
  // takes precedence over the voucher's own validTo. Per-user-expired vouchers are
  // already hidden by the backend, so a shown deadline is always still in the future.
  const deadline = v.expiresAt ?? v.validTo;

  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{title}</span>
          <CopyableCode
            code={v.code}
            copyLabel={t('copyCode')}
            copiedLabel={t('copied')}
          />
        </div>
        <Badge>{discountLabel}</Badge>
      </div>

      {description ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}

      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>{usesLeft}</span>
        {v.minOrderCents != null ? (
          <span>{t('minOrder', { amount: formatPriceCents(v.minOrderCents) })}</span>
        ) : null}
        {v.maxDiscountCents != null ? (
          <span>
            {t('maxDiscount', { amount: formatPriceCents(v.maxDiscountCents) })}
          </span>
        ) : null}
        {deadline ? (
          <span>{t('validUntil', { date: formatDate(deadline, locale) })}</span>
        ) : null}
      </div>
    </li>
  );
}

// Click-to-copy voucher code (mirror of the admin CopyableId): inline 1.5s
// feedback, swallows clipboard failures in an insecure context.
function CopyableCode({
  code,
  copyLabel,
  copiedLabel,
}: {
  code: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (insecure context) — silently ignore.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={copyLabel}
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-xs"
    >
      <span className="font-mono">{code}</span>
      <Copy className="size-3" />
      {copied ? <span>{copiedLabel}</span> : null}
    </button>
  );
}

// Small inline badge — this project has no shadcn Badge primitive.
function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="bg-foreground/5 rounded px-2 py-0.5 text-xs">{children}</span>
  );
}
