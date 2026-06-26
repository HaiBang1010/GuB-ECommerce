import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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

// Query params arrive as strings (no implicit conversion) — coerce to a number so
// @IsInt validates it; a non-numeric value becomes NaN and is rejected (400).
function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
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

  // 1-based page number (default 1).
  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  // Rows per page (default 10, capped at 100).
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10, example: 10 })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
