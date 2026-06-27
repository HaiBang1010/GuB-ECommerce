'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  useAdminProducts,
  useSetProductSale,
} from '@/features/admin/sales/hooks/use-admin-sales';
import type { AdminProduct } from '@/features/admin/sales/api/products';
import { ApiError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPriceCents } from '@/lib/money';

export function AdminSalesView() {
  const t = useTranslations('admin');
  const [searchInput, setSearchInput] = useState('');

  const { isPending, isError, data } = useAdminProducts();

  const products = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    const all = data ?? [];
    if (!q) return all;
    return all.filter(
      (p) =>
        p.nameVi.toLowerCase().includes(q) ||
        p.nameEn.toLowerCase().includes(q),
    );
  }, [data, searchInput]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('sales')}</h1>
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('searchProducts')}
          className="w-full sm:w-64"
        />
      </div>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t('productsError')}</p>
      ) : products.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('noProducts')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p) => (
            <SaleRow key={p.id} product={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SaleRow({ product }: { product: AdminProduct }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const setSale = useSetProductSale();
  // Local edit buffer, seeded from the current sale (cents). '' = no sale set.
  const [input, setInput] = useState(
    product.salePriceCents != null ? String(product.salePriceCents) : '',
  );

  const name = locale === 'vi' ? product.nameVi : product.nameEn;
  const onSale = product.salePriceCents != null;

  function save() {
    const cents = Number(input);
    if (!Number.isInteger(cents) || cents <= 0) {
      toast.error(t('saleError'));
      return;
    }
    setSale.mutate(
      { id: product.id, salePriceCents: cents },
      {
        onSuccess: () => toast.success(t('saleSaved')),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t('saleError')),
      },
    );
  }

  function clear() {
    setSale.mutate(
      { id: product.id, salePriceCents: null },
      {
        onSuccess: () => {
          setInput('');
          toast.success(t('saleCleared'));
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t('saleError')),
      },
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{name}</span>
        <span className="text-muted-foreground text-xs">
          {t('basePrice')}: {formatPriceCents(product.basePriceCents)}
          {' · '}
          {t('salePrice')}:{' '}
          {onSale ? formatPriceCents(product.salePriceCents!) : t('noSale')}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('centsHint')}
          className="w-32"
        />
        <Button
          size="sm"
          disabled={setSale.isPending || input.trim() === ''}
          onClick={save}
        >
          {t('setSale')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={setSale.isPending || !onSale}
          onClick={clear}
        >
          {t('clearSale')}
        </Button>
      </div>
    </li>
  );
}
