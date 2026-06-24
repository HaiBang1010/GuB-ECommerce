import { ApiProperty } from '@nestjs/swagger';

// Response shape of a product.ProductImage row. `publicId` is the Cloudinary
// asset id — safe to expose (it's part of the public delivery URL). Codegen type.
export class ImageResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9img01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9prd01' })
  productId!: string;

  @ApiProperty({
    example:
      'https://res.cloudinary.com/demo/image/upload/v1700000000/gub/products/ao-thun-basic/white-front.jpg',
  })
  url!: string;

  @ApiProperty({ example: 'gub/products/ao-thun-basic/white-front' })
  publicId!: string;

  @ApiProperty({ type: String, nullable: true, example: 'White' })
  color!: string | null;

  @ApiProperty({ example: 0 })
  position!: number;
}

// Signed params the browser echoes back to Cloudinary on a direct upload. The
// signature is per-upload and short-lived; the API secret never leaves the server.
export class SignedUploadResponseDto {
  @ApiProperty({ example: 'demo' })
  cloudName!: string;

  @ApiProperty({ example: '123456789012345' })
  apiKey!: string;

  @ApiProperty({ example: 1700000000 })
  timestamp!: number;

  @ApiProperty({ example: 'gub/products/clx1a2b3c4d5e6f7g8h9prd01' })
  folder!: string;

  @ApiProperty({ example: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0' })
  signature!: string;
}
