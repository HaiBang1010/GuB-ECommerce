import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// Admin: grant a (wallet-only) voucher to a specific user so they can redeem it.
export class GrantVoucherDto {
  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9usr01',
    description: 'The iam.User id to grant this voucher to.',
  })
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
