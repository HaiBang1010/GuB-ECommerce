import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListOrdersQueryDto {
  // Optional ?status=... filter for the admin order list.
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
