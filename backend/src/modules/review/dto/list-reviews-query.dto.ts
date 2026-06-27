import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

// Query params arrive as strings (the global ValidationPipe has transform:true but
// NOT enableImplicitConversion) — coerce to a number so @IsInt validates it; a
// non-numeric value becomes NaN and is rejected (400). Mirrors list-orders-query.
function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

// Coerce the ?replied param to a boolean: 'true'/'false' (or undefined). Anything
// else stays a string and is rejected by @IsBoolean (400).
function toBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value as never;
}

export class ListReviewsQueryDto {
  // Optional reply-state filter: true = already replied, false = awaiting a reply,
  // omitted = all reviews.
  @ApiPropertyOptional({
    description: 'Filter by reply state: true=replied, false=unreplied.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  replied?: boolean;

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
