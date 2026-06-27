import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Storefront preview: validate a code against the caller's CURRENT cart subtotal
// (read server-side — the FE never supplies the amount).
export class PreviewVoucherDto {
  @ApiProperty({ example: 'SUMMER10' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;
}
