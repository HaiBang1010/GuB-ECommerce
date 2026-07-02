import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

// Headline KPIs for the dashboard cards. Money is integer USD cents. `netRevenueCents`
// and `orderCount` cover only paid orders (SPENT_STATUSES); `aovCents` is the average
// order value (net / orders, 0 when there are no orders).
export class AnalyticsKpiDto {
  @ApiProperty({ example: 1234500, description: 'Net revenue in integer cents.' })
  netRevenueCents!: number;

  @ApiProperty({ example: 87, description: 'Paid order count in the window.' })
  orderCount!: number;

  @ApiProperty({ example: 14189, description: 'Average order value in integer cents.' })
  aovCents!: number;

  @ApiProperty({ example: 213, description: 'Units sold across paid orders.' })
  unitsSold!: number;

  @ApiProperty({ example: 24, description: 'New user signups in the window.' })
  newUsers!: number;
}

// One day of the revenue time series (UTC day). Dense — every day in the window is
// present, with 0 when there were no paid orders that day.
export class RevenuePointDto {
  @ApiProperty({ example: '2026-06-15', description: 'UTC day (YYYY-MM-DD).' })
  date!: string;

  @ApiProperty({ example: 45600, description: 'Net revenue that day, integer cents.' })
  revenueCents!: number;

  @ApiProperty({ example: 3, description: 'Paid orders that day.' })
  orderCount!: number;
}

// One day of the new-users time series (UTC day; dense, 0-filled).
export class NewUsersPointDto {
  @ApiProperty({ example: '2026-06-15', description: 'UTC day (YYYY-MM-DD).' })
  date!: string;

  @ApiProperty({ example: 2, description: 'Signups that day.' })
  count!: number;
}

// Count + gross total of orders in a given status within the window. Every status
// the query saw is returned (a status with no orders is simply absent).
export class OrdersByStatusPointDto {
  @ApiProperty({ enum: OrderStatus, example: OrderStatus.PAID })
  status!: OrderStatus;

  @ApiProperty({ example: 12 })
  count!: number;

  @ApiProperty({ example: 156700, description: 'Sum of totalCents for that status.' })
  totalCents!: number;
}

// The dashboard "summary" payload: KPI cards + revenue/new-users time series +
// orders-by-status breakdown. Composed in-process from the order + iam modules
// (never a cross-schema JOIN).
export class AnalyticsSummaryResponseDto {
  @ApiProperty({ type: AnalyticsKpiDto })
  kpi!: AnalyticsKpiDto;

  @ApiProperty({ type: [RevenuePointDto] })
  revenue!: RevenuePointDto[];

  @ApiProperty({ type: [NewUsersPointDto] })
  newUsers!: NewUsersPointDto[];

  @ApiProperty({ type: [OrdersByStatusPointDto] })
  ordersByStatus!: OrdersByStatusPointDto[];
}
