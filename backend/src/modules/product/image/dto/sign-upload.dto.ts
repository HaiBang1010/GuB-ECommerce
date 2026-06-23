import { IsNotEmpty, IsString } from 'class-validator';

// Body for requesting a signed direct-upload. Existence of the product is
// validated in the service (via ProductService).
export class SignUploadDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;
}
