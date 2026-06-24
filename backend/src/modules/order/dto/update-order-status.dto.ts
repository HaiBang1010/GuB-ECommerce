import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrderStatusDto {
  // The target status; the service enforces which transitions are legal.
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PROCESSING,
    description: 'Next fulfillment status (PAID->PROCESSING->SHIPPED->DELIVERED).',
  })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({ example: 'Packed and handed to the carrier.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
