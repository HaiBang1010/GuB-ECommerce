import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// Body for requesting a signed direct-upload. Existence of the product is
// validated in the service (via ProductService).
export class SignUploadDto {
  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9prd01',
    description: 'Product the upload will be scoped to.',
  })
  @IsString()
  @IsNotEmpty()
  productId!: string;
}
