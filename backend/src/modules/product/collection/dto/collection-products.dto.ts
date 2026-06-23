import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator';

// Body for attaching/detaching products to a collection (n-n membership).
// Existence of each product is validated in the service (via ProductService).
export class CollectionProductsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  productIds!: string[];
}
