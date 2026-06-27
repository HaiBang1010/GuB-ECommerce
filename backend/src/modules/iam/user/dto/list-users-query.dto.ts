import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Query params arrive as strings (the global ValidationPipe has transform:true but
// NOT enableImplicitConversion) — coerce to a number so @IsInt validates it; a
// non-numeric value becomes NaN and is rejected (400). Mirrors list-orders-query.
function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

export class ListUsersQueryDto {
  // Optional search: matches the customer's name or email.
  @ApiPropertyOptional({
    description: 'Search by customer name or email.',
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
