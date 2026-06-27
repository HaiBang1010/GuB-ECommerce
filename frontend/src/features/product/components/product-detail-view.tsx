'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useProduct } from '@/features/product/hooks/use-product';
import { useAddToCart } from '@/features/cart/hooks/use-cart';
import { useProductReviews } from '@/features/review/hooks/use-reviews';
import { useCartStore } from '@/stores/cart.store';
import { useAuthStore } from '@/stores/auth.store';
import { isAdmin } from '@/features/auth/is-admin';
import { AdminReplyForm } from '@/features/admin/reviews/components/admin-reply-form';
import { StarRating } from '@/components/star-rating';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatPriceCents } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/datetime';
import type { ProductDetail, ProductVariant } from '@/features/product/api/products';

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
  const addToCart = useAddToCart();
  const setSnapshot = useCartStore((s) => s.setSnapshot);

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

  // The price actually charged folds in the product-level sale, but only when it
  // undercuts the variant's own price (a sale never raises the price). Mirrors the
  // backend ProductVariantService.effectivePrice so display matches the charge.
  const effectivePrice = (v: ProductVariant) =>
    product.salePriceCents !== null && product.salePriceCents < v.priceCents
      ? product.salePriceCents
      : v.priceCents;

  const lowestEffectiveCents =
    product.variants.length > 0
      ? Math.min(...product.variants.map(effectivePrice))
      : (product.salePriceCents ?? product.basePriceCents);
  const lowestBaseCents =
    product.variants.length > 0
      ? Math.min(...product.variants.map((v) => v.priceCents))
      : product.basePriceCents;

  // Price shown + the struck-through pre-sale price (null = not discounted).
  const priceCents = selectedVariant
    ? effectivePrice(selectedVariant)
    : lowestEffectiveCents;
  const compareAtCents = selectedVariant
    ? priceCents < selectedVariant.priceCents
      ? selectedVariant.priceCents
      : null
    : lowestEffectiveCents < lowestBaseCents
      ? lowestBaseCents
      : null;
  const pricePrefix = selectedVariant ? '' : `${t('from')} `;

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
    if (!selectedVariant) return;
    // Cache display info for the cart page (the cart API returns no name/image).
    setSnapshot(selectedVariant.id, {
      nameVi: product.nameVi,
      nameEn: product.nameEn,
      slug: product.slug,
      imageUrl: displayImages[0]?.url ?? null,
    });
    addToCart.mutate({ variantId: selectedVariant.id, quantity: 1 });
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

        <div className="flex items-center gap-2">
          <p className="text-2xl font-bold">
            {pricePrefix}
            {formatPriceCents(priceCents)}
          </p>
          {compareAtCents !== null ? (
            <>
              <span className="text-muted-foreground text-base line-through">
                {pricePrefix}
                {formatPriceCents(compareAtCents)}
              </span>
              <span className="bg-destructive rounded px-1.5 py-0.5 text-xs font-medium text-white">
                {t('onSale')}
              </span>
            </>
          ) : null}
        </div>

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
          disabled={!canAddToCart || addToCart.isPending}
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

      {/* Reviews (full width, public read) */}
      <ProductReviews productId={product.id} />
    </main>
  );
}

function ProductReviews({ productId }: { productId: string }) {
  const t = useTranslations('reviews');
  const locale = useLocale();
  const role = useAuthStore((s) => s.role);
  const admin = isAdmin(role);
  const { isPending, isError, data } = useProductReviews(productId);

  return (
    <section className="flex flex-col gap-4 border-t pt-8 md:col-span-2">
      <h2 className="text-xl font-semibold">{t('title')}</h2>

      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t('error')}</p>
      ) : data.summary.count === 0 ? (
        <div className="flex items-center gap-2">
          <StarRating value={0} readOnly />
          <span className="text-muted-foreground text-sm">
            {t('noReviews')}
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <StarRating value={data.summary.average ?? 0} readOnly size={22} />
            <span className="text-lg font-semibold">
              {(data.summary.average ?? 0).toFixed(1)}
            </span>
            <span className="text-muted-foreground text-sm">
              {t('reviewCount', { count: data.summary.count })}
            </span>
          </div>

          <ul className="flex flex-col gap-4">
            {data.items.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-1 border-b pb-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StarRating value={r.rating} readOnly size={16} />
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                    {t('verifiedBuyer')}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(r.createdAt, locale)}
                  </span>
                </div>
                {r.body ? <p className="text-sm">{r.body}</p> : null}
                {r.adminReply ? (
                  <div className="bg-muted/60 mt-1 rounded-md p-3">
                    <p className="text-xs font-medium">{t('storeReply')}</p>
                    <p className="text-sm">{r.adminReply}</p>
                    {r.adminReplyAt ? (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {formatDateTime(r.adminReplyAt, locale)}
                      </p>
                    ) : null}
                  </div>
                ) : admin ? (
                  <AdminReplyForm reviewId={r.id} />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
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
