import { ApiProperty } from '@nestjs/swagger';

// Response shape of an iam.Address row (owner-scoped; only the caller's own
// addresses are ever returned). Used for OpenAPI codegen.
export class AddressResponseDto {
  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9adr01' })
  id!: string;

  @ApiProperty({ example: 'clx1a2b3c4d5e6f7g8h9usr01', description: 'Owner user id.' })
  userId!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName!: string;

  @ApiProperty({ example: '0901234567' })
  phone!: string;

  @ApiProperty({ example: '12 Nguyễn Huệ' })
  line1!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Tầng 3' })
  line2!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Phường Bến Nghé' })
  ward!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Quận 1' })
  district!: string | null;

  @ApiProperty({ example: 'Hồ Chí Minh' })
  city!: string;

  @ApiProperty({ example: 'VN' })
  country!: string;

  @ApiProperty({ type: String, nullable: true, example: '700000' })
  postalCode!: string | null;

  @ApiProperty({ example: true })
  isDefault!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: null })
  archivedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-01T00:00:00.000Z' })
  createdAt!: Date;
}
