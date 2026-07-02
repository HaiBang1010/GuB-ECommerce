import { OrderStatus } from '@prisma/client';
import { AnalyticsService } from './analytics.service';
import { OrderService } from '../order/order.service';
import { UserService } from '../iam/user/user.service';

// AnalyticsService is a pure orchestrator: it injects OTHER modules' services (never
// Prisma). So the mocks here are the collaborating services — that structurally
// proves the module composes in-process and touches no schema of its own.
describe('AnalyticsService', () => {
  let orders: {
    getRevenueRows: jest.Mock;
    getSignupRows?: jest.Mock;
    getStatusCounts: jest.Mock;
    getProductSales: jest.Mock;
    getTopSpenderTotals: jest.Mock;
  };
  let users: { getSignupRows: jest.Mock; findManyByIds: jest.Mock };
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
    };
    users = {
      getSignupRows: jest.fn().mockResolvedValue([]),
      findManyByIds: jest.fn().mockResolvedValue([]),
    };
    service = new AnalyticsService(
      orders as unknown as OrderService,
      users as unknown as UserService,
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
});
