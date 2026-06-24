'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useProduct } from '@/hooks/use-product';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPriceCents } from '@/lib/money';
import type { ProductDetail, ProductVariant } from '@/lib/api/products';

export function ProductDetailView({ slug }: { slug: string }) {
  const t = useTranslations('product');
  const query = useProduct(slug);

  if (query.isPending) {
    return <DetailSkeleton />;
  }

  if (query.isError) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-destructive mb-4">{t('error')}</p>
        <Button asChild variant="outline">
          <Link href="/products">{t('backToProducts')}</Link>
        </Button>
      </main>
    );
  }

  return <DetailContent product={query.data} />;
}

function DetailContent({ product }: { product: ProductDetail }) {
  const locale = useLocale();
  const t = useTranslations('product');

  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  const name = locale === 'vi' ? product.nameVi : product.nameEn;

  // Unique colors, in first-seen order.
  const colors = [...new Set(product.variants.map((v) => v.color))];

  // Variants (one per size) available for the chosen color.
  const variantsForColor = selectedColor
    ? product.variants.filter((v) => v.color === selectedColor)
    : [];

  const selectedVariant: ProductVariant | null =
    (selectedColor && selectedSize
      ? product.variants.find(
          (v) => v.color === selectedColor && v.size === selectedSize,
        )
      : undefined) ?? null;

  // Images: all of them until a color is picked, then just that color's, sorted.
  const displayImages = (
    selectedColor === null
      ? product.images
      : product.images.filter((img) => img.color === selectedColor)
  )
    .slice()
    .sort((a, b) => a.position - b.position);
  const mainImage = displayImages[activeImage] ?? displayImages[0];

  const lowestPriceCents =
    product.variants.length > 0
      ? Math.min(...product.variants.map((v) => v.priceCents))
      : product.basePriceCents;
  const priceLabel = selectedVariant
    ? formatPriceCents(selectedVariant.priceCents)
    : `${t('from')} ${formatPriceCents(lowestPriceCents)}`;

  const outOfStock = selectedVariant?.stockQty === 0;
  const canAddToCart = selectedVariant !== null && !outOfStock;
  const addToCartLabel = !selectedVariant
    ? t('selectOptions')
    : outOfStock
      ? t('outOfStock')
      : t('addToCart');
  const lowStock =
    selectedVariant !== null &&
    selectedVariant.stockQty > 0 &&
    selectedVariant.stockQty <= 5;

  function handleSelectColor(color: string) {
    setSelectedColor(color);
    setSelectedSize(null); // reset size — it may not exist for the new color
    setActiveImage(0);
  }

  function handleAddToCart() {
    // TODO: wire to the cart store in the auth/cart slice.
    console.log('add', selectedVariant);
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-2">
      {/* Gallery */}
      <div className="flex flex-col gap-4">
        <div className="bg-muted aspect-square w-full overflow-hidden rounded-xl">
          {mainImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- raw Cloudinary URLs; next/image optimization is Phase 7
            <img
              src={mainImage.url}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full" aria-hidden />
          )}
        </div>

        {displayImages.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {displayImages.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveImage(i)}
                className={cn(
                  'bg-muted aspect-square w-16 overflow-hidden rounded-md border',
                  i === activeImage && 'ring-ring ring-2',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                <img
                  src={img.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{name}</h1>
          {product.brand ? (
            <p className="text-muted-foreground mt-1 text-sm">
              {t('brand')}: {product.brand}
            </p>
          ) : null}
        </div>

        <p className="text-2xl font-bold">{priceLabel}</p>

        {/* Color selector */}
        {colors.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t('color')}</span>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleSelectColor(color)}
                  title={color}
                  aria-label={color}
                  aria-pressed={selectedColor === color}
                  className={cn(
                    'size-8 rounded-full border',
                    selectedColor === color &&
                      'ring-ring ring-2 ring-offset-2',
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {/* Size selector */}
        {selectedColor && variantsForColor.length > 0 ? (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t('size')}</span>
            <div className="flex flex-wrap gap-2">
              {variantsForColor.map((v) => {
                const soldOut = v.stockQty === 0;
                return (
                  <Button
                    key={v.id}
                    type="button"
                    variant={selectedSize === v.size ? 'default' : 'outline'}
                    size="sm"
                    disabled={soldOut}
                    onClick={() => setSelectedSize(v.size)}
                    className={cn(soldOut && 'line-through')}
                  >
                    {v.size}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Low-stock hint */}
        {lowStock && selectedVariant ? (
          <p className="text-muted-foreground text-sm">
            {t('onlyXLeft', { count: selectedVariant.stockQty })}
          </p>
        ) : null}

        <Button
          type="button"
          size="lg"
          disabled={!canAddToCart}
          onClick={handleAddToCart}
          className="w-full sm:w-auto"
        >
          {addToCartLabel}
        </Button>

        <Link
          href="/products"
          className="text-muted-foreground text-sm hover:underline"
        >
          {t('backToProducts')}
        </Link>
      </div>
    </main>
  );
}

function DetailSkeleton() {
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-2">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-11 w-full sm:w-40" />
      </div>
    </main>
  );
}
