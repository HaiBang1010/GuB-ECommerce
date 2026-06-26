import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Normalize the ?status param to an array. The global ValidationPipe has
// transform:true but NOT enableImplicitConversion, so a single ?status=A arrives
// as a string while ?status=A&status=B arrives as a string[]; we also accept CSV
// (?status=A,B). The result is validated element-wise by @IsEnum(..., { each }).
function toStatusArray(value: unknown): OrderStatus[] | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter((s) => s !== '') as OrderStatus[];
}

export class ListOrdersQueryDto {
  // Optional multi-status filter for the admin order list (none = all).
  @ApiPropertyOptional({
    enum: OrderStatus,
    isArray: true,
    description:
      'Filter by one or more statuses — repeat ?status= or comma-separated.',
  })
  @IsOptional()
  @Transform(({ value }) => toStatusArray(value))
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  status?: OrderStatus[];

  // Optional unified search: matches the order id OR the customer's name/email.
  @ApiPropertyOptional({
    description: 'Search by order id, customer name or email.',
    example: 'jane',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
