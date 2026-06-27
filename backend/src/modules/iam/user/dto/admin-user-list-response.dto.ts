import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

// A row in the admin users list: just the identity basics (no profile/addresses/
// stats — those live on the detail page).
export class AdminUserListItemDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9usr01' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Nguyễn Văn A' })
  name!: string | null;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role!: Role;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-01T00:00:00.000Z',
  })
  createdAt!: Date;
}

// One page of admin users. `total` is the count over the same search filter.
export class PaginatedAdminUsersResponseDto {
  @ApiProperty({ type: [AdminUserListItemDto] })
  items!: AdminUserListItemDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  pageSize!: number;
}
