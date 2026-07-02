import { OrderStatus } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { OrderService } from '../order/order.service';
import { UserService } from '../iam/user/user.service';
import { ProductService } from '../product/product/product.service';
import { CategoryService } from '../product/category/category.service';
import { ProductVariantService } from '../product/variant/variant.service';

// AnalyticsService is a pure orchestrator: it injects OTHER modules' services (never
// Prisma). So the mocks here are the collaborating services — that structurally
// proves the module composes in-process and touches no schema of its own.
describe('AnalyticsService', () => {
  let orders: {
    getRevenueRows: jest.Mock;
    getStatusCounts: jest.Mock;
    getProductSales: jest.Mock;
    getTopSpenderTotals: jest.Mock;
    getVoucherUsage: jest.Mock;
  };
  let users: { getSignupRows: jest.Mock; findManyByIds: jest.Mock };
  let products: { findManyByIds: jest.Mock };
  let categories: { findAllForAdmin: jest.Mock };
  let variants: { getLowStockVariants: jest.Mock };
  let service: AnalyticsService;

  const range = {
    from: new Date('2026-06-01T00:00:00.000Z'),
    to: new Date('2026-06-03T23:59:59.999Z'),
  };

  beforeEach(() => {
    orders = {
      getRevenueRows: jest.fn().mockResolvedValue([]),
      getStatusCounts: jest.fn().mockResolvedValue([]),
      getProductSales: jest.fn().mockResolvedValue([]),
      getTopSpenderTotals: jest.fn().mockResolvedValue([]),
      getVoucherUsage: jest.fn().mockResolvedValue([]),
    };
    users = {
      getSignupRows: jest.fn().mockResolvedValue([]),
      findManyByIds: jest.fn().mockResolvedValue([]),
    };
    products = { findManyByIds: jest.fn().mockResolvedValue([]) };
    categories = { findAllForAdmin: jest.fn().mockResolvedValue([]) };
    variants = { getLowStockVariants: jest.fn().mockResolvedValue([]) };
    service = new AnalyticsService(
      orders as unknown as OrderService,
      users as unknown as UserService,
      products as unknown as ProductService,
      categories as unknown as CategoryService,
      variants as unknown as ProductVariantService,
    );
  });

  describe('getSummary', () => {
    it('buckets revenue by UTC day (dense, 0-filled) and computes KPIs', async () => {
      orders.getRevenueRows.mockResolvedValue([
        { createdAt: new Date('2026-06-01T10:00:00.000Z'), totalCents: 1000 },
        { createdAt: new Date('2026-06-01T12:00:00.000Z'), totalCents: 500 },
        { createdAt: new Date('2026-06-03T00:00:00.000Z'), totalCents: 2000 },
      ]);
      users.getSignupRows.mockResolvedValue([
        { createdAt: new Date('2026-06-02T08:00:00.000Z') },
      ]);
      orders.getProductSales.mockResolvedValue([
        { productId: 'p1', nameVi: 'a', nameEn: 'a', unitsSold: 5, revenueCents: 1000 },
        { productId: 'p2', nameVi: 'b', nameEn: 'b', unitsSold: 3, revenueCents: 2000 },
      ]);
      orders.getStatusCounts.mockResolvedValue([
        { status: OrderStatus.PAID, count: 3, totalCents: 3500 },
      ]);

      const res = await service.getSummary(range);

      // Dense 3-day window, gaps 0-filled.
      expect(res.revenue).toEqual([
        { date: '2026-06-01', revenueCents: 1500, orderCount: 2 },
        { date: '2026-06-02', revenueCents: 0, orderCount: 0 },
        { date: '2026-06-03', revenueCents: 2000, orderCount: 1 },
      ]);
      expect(res.newUsers).toEqual([
        { date: '2026-06-01', count: 0 },
        { date: '2026-06-02', count: 1 },
        { date: '2026-06-03', count: 0 },
      ]);
      // KPIs: net 3500 over 3 paid orders → aov round(3500/3)=1167; units 5+3=8.
      expect(res.kpi).toEqual({
        netRevenueCents: 3500,
        orderCount: 3,
        aovCents: 1167,
        unitsSold: 8,
        newUsers: 1,
      });
      expect(res.ordersByStatus).toEqual([
        { status: OrderStatus.PAID, count: 3, totalCents: 3500 },
      ]);
    });

    it('guards AOV against divide-by-zero when there are no paid orders', async () => {
      const res = await service.getSummary(range);
      expect(res.kpi.aovCents).toBe(0);
      expect(res.kpi.netRevenueCents).toBe(0);
      expect(res.kpi.orderCount).toBe(0);
      // still a dense series of zeros
      expect(res.revenue).toHaveLength(3);
      expect(res.revenue.every((p) => p.revenueCents === 0)).toBe(true);
    });
  });

  describe('getTopSpenders', () => {
    it('enriches totals with email/name and leaves unresolved ids null', async () => {
      orders.getTopSpenderTotals.mockResolvedValue([
        { userId: 'u1', totalSpentCents: 5000, orderCount: 2 },
        { userId: 'ghost', totalSpentCents: 1000, orderCount: 1 },
      ]);
      users.findManyByIds.mockResolvedValue([
        { id: 'u1', email: 'a@x.com', name: 'A' },
      ]);

      const res = await service.getTopSpenders(range, 10);

      expect(orders.getTopSpenderTotals).toHaveBeenCalledWith(range, 10);
      expect(users.findManyByIds).toHaveBeenCalledWith(['u1', 'ghost']);
      expect(res).toEqual([
        { userId: 'u1', email: 'a@x.com', name: 'A', totalSpentCents: 5000, orderCount: 2 },
        { userId: 'ghost', email: null, name: null, totalSpentCents: 1000, orderCount: 1 },
      ]);
    });
  });

  describe('getTopProducts', () => {
    it('sorts by revenue desc and slices to the limit', async () => {
      orders.getProductSales.mockResolvedValue([
        { productId: 'p1', nameVi: 'a', nameEn: 'a', unitsSold: 1, revenueCents: 100 },
        { productId: 'p2', nameVi: 'b', nameEn: 'b', unitsSold: 1, revenueCents: 300 },
        { productId: 'p3', nameVi: 'c', nameEn: 'c', unitsSold: 1, revenueCents: 200 },
      ]);

      const res = await service.getTopProducts(range, 2);

      expect(res.map((p) => p.productId)).toEqual(['p2', 'p3']);
    });
  });

  describe('getSalesByCategory', () => {
    it('maps products to categories, sums per category, sorts by revenue', async () => {
      orders.getProductSales.mockResolvedValue([
        { productId: 'p1', nameVi: 'a', nameEn: 'a', unitsSold: 2, revenueCents: 2000 },
        { productId: 'p2', nameVi: 'b', nameEn: 'b', unitsSold: 1, revenueCents: 1000 },
        { productId: 'p3', nameVi: 'c', nameEn: 'c', unitsSold: 5, revenueCents: 9000 },
      ]);
      // p1 + p2 in category c1; p3 in category c2.
      products.findManyByIds.mockResolvedValue([
        { id: 'p1', categoryId: 'c1' },
        { id: 'p2', categoryId: 'c1' },
        { id: 'p3', categoryId: 'c2' },
      ]);
      categories.findAllForAdmin.mockResolvedValue([
        { id: 'c1', nameVi: 'Áo', nameEn: 'Tops' },
        { id: 'c2', nameVi: 'Giày', nameEn: 'Shoes' },
      ]);

      const res = await service.getSalesByCategory(range);

      // c2 (9000) before c1 (3000); c1 folds p1+p2.
      expect(res).toEqual([
        { categoryId: 'c2', nameVi: 'Giày', nameEn: 'Shoes', unitsSold: 5, revenueCents: 9000 },
        { categoryId: 'c1', nameVi: 'Áo', nameEn: 'Tops', unitsSold: 3, revenueCents: 3000 },
      ]);
    });

    it('buckets a product with no resolvable category under "uncategorized"', async () => {
      orders.getProductSales.mockResolvedValue([
        { productId: 'gone', nameVi: 'x', nameEn: 'x', unitsSold: 1, revenueCents: 500 },
      ]);
      products.findManyByIds.mockResolvedValue([]); // product not found
      categories.findAllForAdmin.mockResolvedValue([]);

      const res = await service.getSalesByCategory(range);

      expect(res).toEqual([
        { categoryId: 'uncategorized', nameVi: 'Uncategorized', nameEn: 'Uncategorized', unitsSold: 1, revenueCents: 500 },
      ]);
    });

    it('returns [] with no product lookups when there are no sales', async () => {
      orders.getProductSales.mockResolvedValue([]);
      const res = await service.getSalesByCategory(range);
      expect(res).toEqual([]);
      expect(products.findManyByIds).not.toHaveBeenCalled();
    });
  });

  describe('getVoucherUsage', () => {
    it('passes through the order aggregation, sorted by discount desc', async () => {
      orders.getVoucherUsage.mockResolvedValue([
        { voucherCode: 'SMALL', orderCount: 5, discountCents: 1000 },
        { voucherCode: 'BIG', orderCount: 2, discountCents: 8000 },
      ]);
      const res = await service.getVoucherUsage(range);
      expect(res.map((v) => v.voucherCode)).toEqual(['BIG', 'SMALL']);
    });
  });

  describe('getLowStock', () => {
    it('delegates to the variant service with the threshold', async () => {
      variants.getLowStockVariants.mockResolvedValue([
        { variantId: 'v1', sku: 'S', productId: 'p1', nameVi: 'a', nameEn: 'a', size: 'M', color: 'Red', stockQty: 1 },
      ]);
      const res = await service.getLowStock(3);
      expect(variants.getLowStockVariants).toHaveBeenCalledWith(3);
      expect(res).toHaveLength(1);
    });
  });
});
