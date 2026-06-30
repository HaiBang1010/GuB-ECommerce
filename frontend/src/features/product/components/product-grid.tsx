import { ProductCard } from '@/features/product/components/product-card';
import type { Product } from '@/features/product/api/products';

// Responsive grid layout used by the storefront product list AND the collection page,
// so both lay out cards identically. Presentational only — no data fetching.
const GRID_CLASS =
  'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className={GRID_CLASS}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
