import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

// Persist an uploaded asset. The url is checked against the account prefix in the
// service; existence of the product is validated via ProductService.
export class CreateImageDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/v1700000000/gub/products/ao-thun-basic/white-front.jpg',
    description: 'Cloudinary secure_url returned by the direct upload.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;

  @ApiProperty({
    example: 'gub/products/ao-thun-basic/white-front',
    description: 'Cloudinary public_id (used to delete the asset).',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  publicId!: string;

  // Color tag matching a ProductVariant.color; omit for a generic/shared image.
  @ApiPropertyOptional({ example: 'White', description: 'Variant color; omit for a generic image.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  color?: string;

  @ApiPropertyOptional({ example: 0, description: 'Sort position; defaults to 0.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
