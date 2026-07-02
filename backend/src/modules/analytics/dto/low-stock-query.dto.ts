import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

// Low-stock is time-independent (a stock snapshot), so it takes only a threshold —
// no date window. Default 5.
export class LowStockQueryDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 1000, default: 5, example: 5 })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(0)
  @Max(1000)
  threshold?: number;
}
