// Money is stored as integer cents and the catalog is USD-locked on the backend,
// so prices format the same regardless of the UI locale.
const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export function formatPriceCents(cents: number): string {
  return usdFormatter.format(cents / 100);
}
