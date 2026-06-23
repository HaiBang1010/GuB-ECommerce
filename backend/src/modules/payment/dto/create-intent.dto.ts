import { IsNotEmpty, IsString } from 'class-validator';

export class CreateIntentDto {
  // Ownership + payable state of the order are validated in the service.
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
