import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

// Query params for the storefront product list. Powers the home carousels (on-sale /
// new arrivals) alongside the existing category + search. The global ValidationPipe has
// no implicit conversion, so the boolean/number params are coerced via @Transform
// (mirrors the voucher pagination DTO).
export class ListProductsQueryDto {
  @ApiPropertyOptional({ description: 'Narrow to one (visible) category by slug.' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Full-text + fuzzy search (combinable with category).' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Only products currently on sale.' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  onSale?: boolean;

  @ApiPropertyOptional({ enum: ['new'], description: "Sort order; 'new' = newest first." })
  @IsOptional()
  @IsIn(['new'])
  sort?: 'new';

  @ApiPropertyOptional({ type: Number, example: 12, description: 'Max items returned (>= 1).' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === '' ? undefined : Number(value),
  )
  @IsInt()
  @Min(1)
  limit?: number;
}
