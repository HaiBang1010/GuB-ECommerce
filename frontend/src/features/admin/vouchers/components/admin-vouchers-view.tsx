'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  useAdminVouchers,
  useArchiveVoucher,
  useGrantVoucher,
  useVoucherGrants,
} from '@/features/admin/vouchers/hooks/use-admin-vouchers';
import type { Voucher } from '@/features/admin/vouchers/api/vouchers';
import { VoucherForm } from '@/features/admin/vouchers/components/voucher-form';
import { PaginationBar } from '@/features/admin/components/pagination-bar';
import { useDebounce } from '@/features/admin/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatPriceCents } from '@/lib/money';
import { formatDate } from '@/lib/datetime';

export function AdminVouchersView() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const search = useDebounce(searchInput, 300);
  // null = sheet closed · 'new' = create form · a Voucher = edit form.
  const [editing, setEditing] = useState<Voucher | 'new' | null>(null);
  // The voucher whose grant panel is open (wallet-only only).
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [grantEmail, setGrantEmail] = useState('');

  const { isPending, isError, data } = useAdminVouchers(search, page, pageSize);
  const archive = useArchiveVoucher();
  const grant = useGrantVoucher();
  const grants = useVoucherGrants(grantingId);

  function handleSearch(value: string) {
    setSearchInput(value);
    setPage(1);
  }
  function handlePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  function handleArchive(v: Voucher) {
    if (!window.confirm(t('archiveConfirm'))) return;
    archive.mutate(v.id, {
      onSuccess: () => toast.success(t('voucherArchived')),
      onError: () => toast.error(t('saveError')),
    });
  }

  function toggleGrant(voucherId: string) {
    setGrantEmail('');
    setGrantingId(grantingId === voucherId ? null : voucherId);
  }

  function handleGrant(voucherId: string) {
    const email = grantEmail.trim();
    if (!email) return;
    grant.mutate(
      { id: voucherId, email },
      {
        onSuccess: () => {
          toast.success(t('voucherGranted'));
          setGrantEmail('');
        },
        onError: () => toast.error(t('grantError')),
      },
    );
  }

  function valueLabel(v: Voucher): string {
    return v.type === 'PERCENT' ? `${v.value}%` : formatPriceCents(v.value);
  }
  function titleFor(v: Voucher): string | null {
    return locale === 'vi' ? v.titleVi : v.titleEn;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('vouchersTitle')}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('searchVouchers')}
            className="w-full sm:w-64"
          />
          <Button onClick={() => setEditing('new')}>{t('newVoucher')}</Button>
        </div>
      </div>

      {/* New / Edit voucher — slides in from the right (long form). */}
      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editing === 'new' ? t('newVoucher') : t('editVoucher')}
            </SheetTitle>
          </SheetHeader>
          {editing !== null ? (
            <VoucherForm
              key={editing === 'new' ? 'new' : editing.id}
              voucher={editing === 'new' ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t('vouchersError')}</p>
      ) : data.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noVouchers')}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {data.items.map((v) => (
              <li
                key={v.id}
                className="flex flex-col gap-2 rounded-md border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium">{v.code}</span>
                    {titleFor(v) ? (
                      <span className="text-muted-foreground text-sm">
                        {titleFor(v)}
                      </span>
                    ) : null}
                    <Badge>{valueLabel(v)}</Badge>
                    <Badge>{v.isPublic ? t('public') : t('walletOnly')}</Badge>
                    {v.archivedAt ? (
                      <Badge variant="muted">{t('archived')}</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(v)}
                    >
                      {t('edit')}
                    </Button>
                    {!v.isPublic ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleGrant(v.id)}
                      >
                        {t('grant')}
                      </Button>
                    ) : null}
                    {!v.archivedAt ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(v)}
                      >
                        {t('archive')}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>
                    {t('usedCount')}: {v.usedCount}
                    {v.usageLimit != null ? ` / ${v.usageLimit}` : ''}
                  </span>
                  {v.perUserLimit != null ? (
                    <span>
                      {t('perUserLimit')}: {v.perUserLimit}
                    </span>
                  ) : null}
                  {v.minOrderCents != null ? (
                    <span>
                      {t('minOrder')}: {formatPriceCents(v.minOrderCents)}
                    </span>
                  ) : null}
                  {v.maxDiscountCents != null ? (
                    <span>
                      {t('maxDiscount')}: {formatPriceCents(v.maxDiscountCents)}
                    </span>
                  ) : null}
                  {v.validFrom ? (
                    <span>
                      {t('validFrom')}: {formatDate(v.validFrom, locale)}
                    </span>
                  ) : null}
                  {v.validTo ? (
                    <span>
                      {t('validTo')}: {formatDate(v.validTo, locale)}
                    </span>
                  ) : null}
                </div>

                {/* Grant panel — wallet-only vouchers; public ones need no grant. */}
                {!v.isPublic && grantingId === v.id ? (
                  <div className="flex flex-col gap-2 border-t pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="email"
                        value={grantEmail}
                        onChange={(e) => setGrantEmail(e.target.value)}
                        placeholder={t('grantEmailPlaceholder')}
                        className="w-full sm:w-80"
                      />
                      <Button
                        size="sm"
                        disabled={!grantEmail.trim() || grant.isPending}
                        onClick={() => handleGrant(v.id)}
                      >
                        {t('grant')}
                      </Button>
                    </div>

                    {grants.isPending ? (
                      <Skeleton className="h-12 w-full" />
                    ) : grants.data && grants.data.length > 0 ? (
                      <ul className="flex flex-col gap-1 text-xs">
                        {grants.data.map((g) => (
                          <li
                            key={g.userId}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="truncate">
                              {g.email ?? g.userId}
                            </span>
                            <span className="text-muted-foreground">
                              {g.usedCount > 0
                                ? t('grantUsed')
                                : t('grantUnused')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {t('noGrants')}
                      </p>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {data.total > 0 ? (
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={data.total}
              onPage={setPage}
              onPageSize={handlePageSize}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'muted';
}) {
  return (
    <span
      className={
        variant === 'muted'
          ? 'bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs'
          : 'bg-foreground/5 rounded px-2 py-0.5 text-xs'
      }
    >
      {children}
    </span>
  );
}
