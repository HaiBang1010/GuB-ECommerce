import { ApiProperty } from '@nestjs/swagger';
import { OrderResponseDto } from './order-response.dto';

// Minimal customer identity attached to an admin order row, resolved in-process
// from the iam module (UserService) — NOT a cross-schema JOIN. name/email live on
// iam.User; the whole object is null when the user row can't be resolved.
export class CustomerSummaryDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Nguyễn Văn A' })
  name!: string | null;
}

// Admin order-list row: the full order plus the enriched customer summary.
export class OrderAdminResponseDto extends OrderResponseDto {
  @ApiProperty({ type: CustomerSummaryDto, nullable: true })
  customer!: CustomerSummaryDto | null;
}
