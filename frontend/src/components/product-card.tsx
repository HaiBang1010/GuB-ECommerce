'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPriceCents } from '@/lib/money';
import type { Product } from '@/lib/api/products';

export function ProductCard({ product }: { product: Product }) {
  const locale = useLocale();
  const t = useTranslations('Products');
  const name = locale === 'vi' ? product.nameVi : product.nameEn;
  const sale = product.salePriceCents;

  return (
    <Link href={`/products/${product.slug}`} className="block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          {product.brand ? (
            <span className="text-muted-foreground text-sm">
              {product.brand}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          {sale !== null ? (
            <>
              <span className="text-base font-semibold">
                {formatPriceCents(sale)}
              </span>
              <span className="text-muted-foreground text-sm line-through">
                {formatPriceCents(product.basePriceCents)}
              </span>
              <span className="bg-destructive rounded px-1.5 py-0.5 text-xs font-medium text-white">
                {t('onSale')}
              </span>
            </>
          ) : (
            <span className="text-base font-semibold">
              {formatPriceCents(product.basePriceCents)}
            </span>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
