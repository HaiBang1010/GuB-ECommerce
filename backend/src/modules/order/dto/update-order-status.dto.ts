import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderStatusDto {
  // The target status; the service enforces which transitions are legal.
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
