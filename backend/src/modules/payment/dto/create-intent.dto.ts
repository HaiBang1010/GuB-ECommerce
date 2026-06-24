import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateIntentDto {
  // Ownership + payable state of the order are validated in the service.
  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9ord01',
    description: "The caller's unpaid order id to pay for.",
  })
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
