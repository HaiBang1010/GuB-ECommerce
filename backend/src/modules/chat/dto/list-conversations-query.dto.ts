import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Query params arrive as strings (the global ValidationPipe has transform:true but
// NOT enableImplicitConversion), so page/pageSize are coerced via @Transform; a
// non-numeric value becomes NaN and is rejected (400). Mirrors ListVouchersQueryDto.
function toInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
}

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    description: 'Search by customer name or email (substring).',
    example: 'jane',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10, example: 10 })
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
