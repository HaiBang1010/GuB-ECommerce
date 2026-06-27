import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

// Admin: grant a (wallet-only) voucher to a user, identified by email.
export class GrantVoucherDto {
  @ApiProperty({
    example: 'jane@example.com',
    description: 'Email of the user to grant this voucher to.',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
