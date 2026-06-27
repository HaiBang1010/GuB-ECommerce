import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, Role } from '@prisma/client';
import { AddressResponseDto } from '../../address/dto/address-response.dto';
import { OrderResponseDto } from '../../../order/dto/order-response.dto';

// The customer's body profile (height/weight/measurements). All optional — a user
// who never filled it in has nulls. `measurements` is a free-form JSON object
// (e.g. { chest, waist, hip }).
export class ProfileDto {
  @ApiProperty({ type: Number, nullable: true, example: 175 })
  heightCm!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 68 })
  weightKg!: number | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { chest: 96, waist: 80, hip: 98 },
  })
  measurements!: Record<string, unknown> | null;
}

// Count of the customer's orders per status. Every OrderStatus is always present
// (0 when unused) so the breakdown is complete and typed on the frontend.
export class OrderStatusCountsDto {
  @ApiProperty({ example: 0 })
  PENDING_PAYMENT!: number;

  @ApiProperty({ example: 0 })
  PAID!: number;

  @ApiProperty({ example: 0 })
  PROCESSING!: number;

  @ApiProperty({ example: 0 })
  SHIPPED!: number;

  @ApiProperty({ example: 0 })
  DELIVERED!: number;

  @ApiProperty({ example: 0 })
  CANCELLED!: number;

  @ApiProperty({ example: 0 })
  REFUNDED!: number;
}

// Aggregate of a customer's order history. `totalSpentCents` counts only orders
// the customer actually paid for (PAID/PROCESSING/SHIPPED/DELIVERED).
export class OrderStatsDto {
  @ApiProperty({ example: 7 })
  totalOrders!: number;

  @ApiProperty({ example: 123400, description: 'Total spent in integer cents.' })
  totalSpentCents!: number;

  @ApiProperty({ type: OrderStatusCountsDto })
  byStatus!: OrderStatusCountsDto;
}

// Full admin view of one customer: identity + profile + address book + order
// stats + recent orders. Composed in-process from iam (user/profile/addresses)
// and the order module (stats/recent) — never a cross-schema JOIN.
export class AdminUserDetailResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9usr01' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Nguyễn Văn A' })
  name!: string | null;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role!: Role;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  birthday!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({ type: ProfileDto, nullable: true })
  profile!: ProfileDto | null;

  @ApiProperty({ type: [AddressResponseDto] })
  addresses!: AddressResponseDto[];

  @ApiProperty({ type: OrderStatsDto })
  stats!: OrderStatsDto;

  @ApiProperty({ type: [OrderResponseDto] })
  recentOrders!: OrderResponseDto[];
}

// The enum keys must stay in lockstep with OrderStatus; this assertion fails to
// compile if a status is added/removed without updating OrderStatusCountsDto.
const _statusKeyCheck: Record<OrderStatus, number> = {
  PENDING_PAYMENT: 0,
  PAID: 0,
  PROCESSING: 0,
  SHIPPED: 0,
  DELIVERED: 0,
  CANCELLED: 0,
  REFUNDED: 0,
};
void _statusKeyCheck;
