import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VoucherType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

// Create a voucher. Cross-field rules that class-validator can't express alone —
// PERCENT value <= 100, and validFrom < validTo — are enforced in VoucherService.
export class CreateVoucherDto {
  @ApiProperty({ example: 'SUMMER10', description: 'Unique code; stored UPPERCASE.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ enum: VoucherType, example: VoucherType.PERCENT })
  @IsEnum(VoucherType)
  type!: VoucherType;

  @ApiPropertyOptional({
    default: true,
    description:
      'true = PUBLIC (any code holder); false = WALLET-ONLY (needs a grant).',
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({
    example: 10,
    description: 'PERCENT: 1..100 (percent off). FIXED: amount off in cents.',
  })
  @IsInt()
  @Min(1)
  value!: number;

  @ApiPropertyOptional({ example: 5000, description: 'Minimum order subtotal (cents).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minOrderCents?: number;

  @ApiPropertyOptional({
    example: 2000,
    description: 'Cap for a PERCENT discount (cents).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDiscountCents?: number;

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  validTo?: string;

  @ApiPropertyOptional({ example: 100, description: 'Global redemption cap.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @ApiPropertyOptional({ example: 1, description: 'Per-user redemption cap.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;
}
