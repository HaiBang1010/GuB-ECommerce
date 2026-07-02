import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { AnalyticsRange, OrderService } from '../order/order.service';
import { UserService } from '../iam/user/user.service';

// Runtime shapes returned to the controller. The *-response.dto.ts classes document
// these for OpenAPI (same service-type / DTO split the rest of the codebase uses).
export type AnalyticsKpi = {
  netRevenueCents: number;
  orderCount: number;
  aovCents: number;
  unitsSold: number;
  newUsers: number;
};
export type RevenuePoint = { date: string; revenueCents: number; orderCount: number };
export type NewUsersPoint = { date: string; count: number };
export type OrdersByStatusPoint = {
  status: OrderStatus;
  count: number;
  totalCents: number;
};
export type AnalyticsSummary = {
  kpi: AnalyticsKpi;
  revenue: RevenuePoint[];
  newUsers: NewUsersPoint[];
  ordersByStatus: OrdersByStatusPoint[];
};
export type TopSpender = {
  userId: string;
  email: string | null;
  name: string | null;
  totalSpentCents: number;
  orderCount: number;
};
export type TopProduct = {
  productId: string;
  nameVi: string;
  nameEn: string;
  unitsSold: number;
  revenueCents: number;
};

const DAY_MS = 86_400_000;

/**
 * Read-only admin analytics. A pure ORCHESTRATOR: it never injects PrismaService and
 * never touches another module's tables. Each aggregation query lives in the owning
 * module's service (OrderService for `ordering`, UserService for `iam`); this service
 * only composes + enriches across modules in-process (ARCHITECTURE.md §4.3). Acyclic —
 * nothing imports AnalyticsModule.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly orders: OrderService,
    // UserService comes from the @Global IamModule.
    private readonly users: UserService,
  ) {}

  // The dense list of UTC day keys "YYYY-MM-DD" across the (inclusive) window, so a
  // time series shows every day (0-filled) instead of gaps. Iterating in UTC ms is
  // DST-safe (UTC has no DST).
  private dayKeys(range: AnalyticsRange): string[] {
    const start = Date.UTC(
      range.from.getUTCFullYear(),
      range.from.getUTCMonth(),
      range.from.getUTCDate(),
    );
    const end = Date.UTC(
      range.to.getUTCFullYear(),
      range.to.getUTCMonth(),
      range.to.getUTCDate(),
    );
    const keys: string[] = [];
    for (let t = start; t <= end; t += DAY_MS) {
      keys.push(new Date(t).toISOString().slice(0, 10));
    }
    return keys;
  }

  private dayKey(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  // KPI cards + revenue/new-users time series + orders-by-status breakdown.
  async getSummary(range: AnalyticsRange): Promise<AnalyticsSummary> {
    const [revenueRows, signupRows, statusCounts, productSales] =
      await Promise.all([
        this.orders.getRevenueRows(range),
        this.users.getSignupRows(range),
        this.orders.getStatusCounts(range),
        this.orders.getProductSales(range),
      ]);

    const keys = this.dayKeys(range);

    const revenueMap = new Map(
      keys.map((k) => [k, { revenueCents: 0, orderCount: 0 }]),
    );
    for (const r of revenueRows) {
      const bucket = revenueMap.get(this.dayKey(r.createdAt));
      if (bucket) {
        bucket.revenueCents += r.totalCents;
        bucket.orderCount += 1;
      }
    }
    const revenue: RevenuePoint[] = keys.map((date) => ({
      date,
      ...revenueMap.get(date)!,
    }));

    const signupMap = new Map(keys.map((k) => [k, 0]));
    for (const s of signupRows) {
      const k = this.dayKey(s.createdAt);
      if (signupMap.has(k)) signupMap.set(k, signupMap.get(k)! + 1);
    }
    const newUsers: NewUsersPoint[] = keys.map((date) => ({
      date,
      count: signupMap.get(date)!,
    }));

    const netRevenueCents = revenueRows.reduce((a, r) => a + r.totalCents, 0);
    const orderCount = revenueRows.length;
    const aovCents = orderCount > 0 ? Math.round(netRevenueCents / orderCount) : 0;
    const unitsSold = productSales.reduce((a, p) => a + p.unitsSold, 0);

    return {
      kpi: {
        netRevenueCents,
        orderCount,
        aovCents,
        unitsSold,
        newUsers: signupRows.length,
      },
      revenue,
      newUsers,
      ordersByStatus: statusCounts,
    };
  }

  // Top spenders, enriched with the customer's email/name (in-process, no JOIN). An
  // unresolved id (e.g. a demo/seed id with no iam row) keeps null email/name.
  async getTopSpenders(range: AnalyticsRange, limit: number): Promise<TopSpender[]> {
    const totals = await this.orders.getTopSpenderTotals(range, limit);
    const users = await this.users.findManyByIds(totals.map((t) => t.userId));
    const byId = new Map(users.map((u) => [u.id, u]));
    return totals.map((t) => {
      const u = byId.get(t.userId);
      return {
        userId: t.userId,
        email: u?.email ?? null,
        name: u?.name ?? null,
        totalSpentCents: t.totalSpentCents,
        orderCount: t.orderCount,
      };
    });
  }

  // Best-selling products by revenue (from order-item snapshots — no product lookup).
  async getTopProducts(range: AnalyticsRange, limit: number): Promise<TopProduct[]> {
    const sales = await this.orders.getProductSales(range);
    return [...sales]
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, limit);
  }
}
