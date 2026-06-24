import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

// Body for attaching/detaching products to a collection (n-n membership).
// Existence of each product is validated in the service (via ProductService).
export class CollectionProductsDto {
  @ApiProperty({
    type: [String],
    example: ['clx1a2b3c4d5e6f7g8h9prd01'],
    description: 'Product ids to attach/detach.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  productIds!: string[];
}
