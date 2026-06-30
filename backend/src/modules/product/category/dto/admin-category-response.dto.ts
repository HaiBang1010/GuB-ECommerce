import { ApiProperty } from '@nestjs/swagger';
import { CategoryResponseDto } from './category-response.dto';

// A category row for the admin list, enriched with the ACTIVE product / sub-category
// counts so the UI can warn what archiving would hide. Counts are composed in-process
// (ProductService for products, in-memory for children) — no cross-schema JOIN.
export class AdminCategoryResponseDto extends CategoryResponseDto {
  @ApiProperty({ example: 3, description: 'Active products directly in this category.' })
  productCount!: number;

  @ApiProperty({ example: 1, description: 'Active direct sub-categories.' })
  childCount!: number;
}
