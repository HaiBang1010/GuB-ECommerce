import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

// The authenticated caller's own account (id/email/role + basic profile). `role`
// is the application Role from iam.User — the single source of truth the frontend
// reads to decide admin UI; the backend RoleGuard remains the real gate. Used for
// OpenAPI codegen so the endpoint never serializes to `any`.
export class MeResponseDto {
  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9usr01',
    description: 'Supabase Auth user id.',
  })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ enum: Role, example: Role.CUSTOMER })
  role!: Role;

  @ApiProperty({ type: String, nullable: true, example: 'Nguyễn Văn A' })
  name!: string | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    example: null,
  })
  birthday!: Date | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-06-01T00:00:00.000Z',
  })
  createdAt!: Date;
}
