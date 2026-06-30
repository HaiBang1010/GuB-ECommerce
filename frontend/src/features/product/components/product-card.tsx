'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ImageOff } from 'lucide-react';

import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPriceCents } from '@/lib/money';
import type { Product } from '@/features/product/api/products';

export function ProductCard({ product }: { product: Product }) {
  const locale = useLocale();
  const t = useTranslations('Products');
  const name = locale === 'vi' ? product.nameVi : product.nameEn;
  const sale = product.salePriceCents;

  return (
    <Link href={`/products/${product.slug}`} className="block">
      <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
        {/* Cover image (backend primaryImageUrl). Fixed aspect box + graceful
            placeholder so the card never collapses on a missing/broken image. */}
        <CardImage url={product.primaryImageUrl} alt={name} />
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

function CardImage({ url, alt }: { url: string | null; alt: string }) {
  const [errored, setErrored] = useState(false);
  const broken = !url || errored;
  return (
    <div className="bg-muted text-muted-foreground flex aspect-square w-full items-center justify-center overflow-hidden">
      {broken ? (
        <ImageOff className="size-8 opacity-50" />
      ) : (
        // Arbitrary external host → plain <img> (next/image can't whitelist it),
        // with an onError fallback to the placeholder.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
