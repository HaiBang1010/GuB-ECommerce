import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

// Query params arrive as strings (the global ValidationPipe has transform:true but
// NOT enableImplicitConversion), so coerce to a number; a non-numeric value becomes
// NaN and is rejected by @IsInt (400). Mirrors ListOrdersQueryDto.
function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

const DAY_MS = 86_400_000;
const DEFAULT_DAYS = 30;

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999),
  );
}

// Shared query DTO for the read-only analytics endpoints. `from`/`to` are inclusive
// UTC day bounds (default = the last 30 days). `limit` caps the ranked lists
// (top-spenders / top-products). The `range()` helper resolves the concrete window
// so controllers stay thin; date math lives in one place.
export class AnalyticsRangeQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    description: 'Inclusive start of the window (UTC day). Defaults to 30 days ago.',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    format: 'date',
    description: 'Inclusive end of the window (UTC day). Defaults to today.',
    example: '2026-07-01',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 10, example: 10 })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  // Resolve to a concrete inclusive UTC window. `to` defaults to now (end of the
  // current instant), `from` to the start of the day 29 days before today → 30 days
  // inclusive. An explicit date-only bound is snapped to that UTC day's edges.
  range(): { from: Date; to: Date } {
    const now = new Date();
    const to = this.to ? endOfUtcDay(new Date(this.to)) : now;
    const from = this.from
      ? startOfUtcDay(new Date(this.from))
      : startOfUtcDay(new Date(now.getTime() - (DEFAULT_DAYS - 1) * DAY_MS));
    return { from, to };
  }
}
