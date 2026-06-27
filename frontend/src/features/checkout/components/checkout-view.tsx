'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';

import { Link, useRouter } from '@/i18n/navigation';
import { useAddresses, useCreateAddress } from '@/features/checkout/hooks/use-addresses';
import { useCart } from '@/features/cart/hooks/use-cart';
import { useCreateOrder } from '@/features/order/hooks/use-orders';
import { ApiError } from '@/lib/api/client';
import { isOutOfStockError } from '@/features/order/api/orders';
import { useVoucherPreview } from '@/features/voucher/hooks/use-voucher-preview';
import { isVoucherError, type VoucherError } from '@/features/voucher/api/vouchers';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPriceCents } from '@/lib/money';

const addressSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  line1: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
});
type AddressValues = z.infer<typeof addressSchema>;
const ADDRESS_FIELDS = ['fullName', 'phone', 'line1', 'city', 'country'] as const;

export function CheckoutView() {
  // Don't mount the data-fetching content until the session has settled. For a
  // guest the middleware redirects to login; rendering null here means no
  // auth-required query fires during that brief pre-redirect mount.
  const authReady = !useAuthStore((s) => s.isLoading);
  const user = useAuthStore((s) => s.user);

  if (!authReady) return <CheckoutSkeleton />;
  if (!user) return null;
  return <CheckoutContent />;
}

function CheckoutSkeleton() {
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </main>
  );
}

function CheckoutContent() {
  const t = useTranslations('checkout');
  const tVoucher = useTranslations('voucher');
  const locale = useLocale();
  const router = useRouter();
  const snapshots = useCartStore((s) => s.snapshots);

  const addresses = useAddresses();
  const cart = useCart();
  const createAddr = useCreateAddress();
  const createOrder = useCreateOrder();
  const voucherPreview = useVoucherPreview();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [showForm, setShowForm] = useState(false);
  const [voucherInput, setVoucherInput] = useState('');
  const [applied, setApplied] = useState<{
    code: string;
    label: string;
    discountCents: number;
  } | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);

  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: { country: 'VN' },
  });

  // Preselect the default (or first) address once they load.
  useEffect(() => {
    if (
      selectedAddressId === null &&
      addresses.data &&
      addresses.data.length > 0
    ) {
      const def = addresses.data.find((a) => a.isDefault) ?? addresses.data[0];
      setSelectedAddressId(def.id);
    }
  }, [addresses.data, selectedAddressId]);

  async function onCreateAddress(values: AddressValues) {
    const created = await createAddr.mutateAsync(values);
    setSelectedAddressId(created.id);
    setShowForm(false);
    form.reset({ country: 'VN' });
  }

  function handlePlaceOrder() {
    if (!selectedAddressId) return;
    // The order is placed (stock reserved) here; payment happens on the durable
    // pay page, so the buyer never loses the card field on a tab-switch/refresh.
    // The voucher (if any) is re-validated + redeemed server-side — the preview
    // below is non-binding.
    createOrder.mutate(
      { addressId: selectedAddressId, voucherCode: applied?.code },
      { onSuccess: (order) => router.push(`/orders/${order.id}/pay`) },
    );
  }

  // Voucher: the discount/total are previewed server-side; the backend is the
  // source of truth, so the displayed total clamps the stored discount to the
  // live subtotal and never goes negative.
  const subtotalCents = cart.data?.subtotalCents ?? 0;
  const discountCents = applied
    ? Math.min(applied.discountCents, subtotalCents)
    : 0;
  const totalCents = subtotalCents - discountCents;

  function translateVoucherError(body: VoucherError): string {
    switch (body.code) {
      case 'VOUCHER_NOT_FOUND':
        return tVoucher('errNotFound');
      case 'VOUCHER_NOT_YET_VALID':
        return tVoucher('errNotYetValid');
      case 'VOUCHER_EXPIRED':
        return tVoucher('errExpired');
      case 'VOUCHER_MIN_ORDER_NOT_MET':
        return tVoucher('errMinOrder', {
          min: formatPriceCents(body.minOrderCents ?? 0),
        });
      case 'VOUCHER_USED_UP':
        return tVoucher('errUsedUp');
      case 'VOUCHER_USER_LIMIT':
        return tVoucher('errUserLimit');
      case 'VOUCHER_NOT_AVAILABLE':
        return tVoucher('errNotAvailable');
      default:
        return tVoucher('errGeneric');
    }
  }

  function handleApplyVoucher() {
    const code = voucherInput.trim();
    if (!code) return;
    setVoucherError(null);
    voucherPreview.mutate(code, {
      onSuccess: (preview) => {
        const title = locale === 'vi' ? preview.titleVi : preview.titleEn;
        setApplied({
          code: preview.voucherCode,
          label: title || preview.voucherCode,
          discountCents: preview.discountCents,
        });
        setVoucherInput(preview.voucherCode);
      },
      onError: (err) => {
        setApplied(null);
        setVoucherError(
          err instanceof ApiError && isVoucherError(err.body)
            ? translateVoucherError(err.body)
            : tVoucher('errGeneric'),
        );
      },
    });
  }

  function handleRemoveVoucher() {
    setApplied(null);
    setVoucherInput('');
    setVoucherError(null);
    voucherPreview.reset();
  }

  const items = cart.data?.items ?? [];
  const cartEmpty = !cart.isPending && items.length === 0;
  // Any line whose quantity exceeds live stock (covers a 0-stock item too) blocks
  // checkout — the buyer must fix it in the cart first.
  const hasStockIssue = items.some((i) => i.quantity > i.stockQty);
  const canPlaceOrder =
    selectedAddressId !== null &&
    items.length > 0 &&
    !hasStockIssue &&
    !createOrder.isPending;

  // Distinguish an out-of-stock 409 (stock ran out while paying) from a real
  // payment error, and resolve each failing variant's display name from the cart
  // snapshot store so the message can read "<name> — only N left".
  const orderError = createOrder.error;
  const outOfStockItems =
    orderError instanceof ApiError &&
    orderError.status === 409 &&
    isOutOfStockError(orderError.body)
      ? orderError.body.items
      : null;
  // A voucher that became invalid between preview and place-order (e.g. used up):
  // surface its message so the buyer can remove it and retry.
  const orderVoucherError =
    orderError instanceof ApiError && isVoucherError(orderError.body)
      ? translateVoucherError(orderError.body)
      : null;
  const nameForVariant = (variantId: string): string => {
    const snap = snapshots[variantId];
    if (!snap) return variantId;
    return locale === 'vi' ? snap.nameVi : snap.nameEn;
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
      {/* LEFT — shipping address */}
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <h2 className="text-lg font-medium">{t('shippingAddress')}</h2>

        {addresses.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            {addresses.data && addresses.data.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {addresses.data.map((addr) => (
                  <li key={addr.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                      <input
                        type="radio"
                        name="address"
                        className="mt-1"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                      />
                      <span className="text-sm">
                        <span className="font-medium">{addr.fullName}</span> ·{' '}
                        {addr.phone}
                        <br />
                        {addr.line1}, {addr.city}, {addr.country}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                {t('selectAddress')}
              </p>
            )}

            {showForm ? (
              <form
                onSubmit={form.handleSubmit(onCreateAddress)}
                className="flex flex-col gap-3"
                noValidate
              >
                {ADDRESS_FIELDS.map((field) => (
                  <div key={field} className="flex flex-col gap-1.5">
                    <Label htmlFor={`addr-${field}`}>{t(field)}</Label>
                    <Input id={`addr-${field}`} {...form.register(field)} />
                    {form.formState.errors[field] ? (
                      <p className="text-destructive text-sm">{t('required')}</p>
                    ) : null}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={createAddr.isPending}>
                    {t('saveAddress')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowForm(false)}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowForm(true)}
              >
                {t('addAddress')}
              </Button>
            )}
          </>
        )}
      </section>

      {/* RIGHT — order summary + payment */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">{t('orderSummary')}</h2>

        {cart.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : cartEmpty ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-muted-foreground">{t('emptyCart')}</p>
            <Button asChild variant="outline">
              <Link href="/products">{t('continueShopping')}</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {items.map((item) => (
                <SummaryLine
                  key={item.variantId}
                  variantId={item.variantId}
                  sku={item.sku}
                  size={item.size}
                  color={item.color}
                  quantity={item.quantity}
                  lineCents={item.lineCents}
                />
              ))}
            </ul>
            {/* Voucher */}
            <div className="flex flex-col gap-2 border-t pt-3">
              {applied ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>{tVoucher('applied', { code: applied.label })}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveVoucher}
                  >
                    {tVoucher('remove')}
                  </Button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Input
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value)}
                    placeholder={tVoucher('codePlaceholder')}
                    aria-label={tVoucher('code')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      voucherPreview.isPending || voucherInput.trim() === ''
                    }
                    onClick={handleApplyVoucher}
                  >
                    {voucherPreview.isPending
                      ? tVoucher('applying')
                      : tVoucher('apply')}
                  </Button>
                </div>
              )}
              {voucherError ? (
                <p className="text-destructive text-sm">{voucherError}</p>
              ) : null}
            </div>

            {/* Totals */}
            <div className="flex flex-col gap-1 border-t pt-3">
              <div className="flex justify-between text-sm">
                <span>{tVoucher('subtotal')}</span>
                <span>{formatPriceCents(subtotalCents)}</span>
              </div>
              {discountCents > 0 ? (
                <div className="text-muted-foreground flex justify-between text-sm">
                  <span>{tVoucher('discount')}</span>
                  <span>−{formatPriceCents(discountCents)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-lg font-semibold">
                <span>{tVoucher('total')}</span>
                <span>{formatPriceCents(totalCents)}</span>
              </div>
            </div>

            <>
              {hasStockIssue ? (
                <p className="text-destructive text-sm">
                  {t('reviewCartStock')}{' '}
                  <Link href="/cart" className="underline">
                    {t('title')}
                  </Link>
                </p>
              ) : null}
              <Button
                size="lg"
                disabled={!canPlaceOrder}
                onClick={handlePlaceOrder}
              >
                {createOrder.isPending ? t('processing') : t('placeOrder')}
              </Button>
              {createOrder.isError ? (
                outOfStockItems ? (
                  <div className="flex flex-col gap-1">
                    {outOfStockItems.map((it) => (
                      <p
                        key={it.variantId}
                        className="text-destructive text-sm"
                      >
                        {t('outOfStockError', {
                          name: nameForVariant(it.variantId),
                          count: it.available,
                        })}
                      </p>
                    ))}
                  </div>
                ) : orderVoucherError ? (
                  <p className="text-destructive text-sm">
                    {orderVoucherError}
                  </p>
                ) : (
                  <p className="text-destructive text-sm">
                    {t('paymentError')}
                  </p>
                )
              ) : null}
            </>
          </>
        )}
      </section>
    </main>
  );
}

function SummaryLine({
  variantId,
  sku,
  size,
  color,
  quantity,
  lineCents,
}: {
  variantId: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  lineCents: number;
}) {
  const locale = useLocale();
  const snapshot = useCartStore((s) => s.snapshots[variantId]);
  const name = snapshot
    ? locale === 'vi'
      ? snapshot.nameVi
      : snapshot.nameEn
    : sku;

  return (
    <li className="flex justify-between gap-2 text-sm">
      <span>
        {name} · {size}/{color} × {quantity}
      </span>
      <span>{formatPriceCents(lineCents)}</span>
    </li>
  );
}
