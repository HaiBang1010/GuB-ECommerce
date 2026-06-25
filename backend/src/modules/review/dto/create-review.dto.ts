import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  // Proof of purchase: the productId is derived server-side from this order item,
  // never trusted from the client (anti-forge).
  @ApiProperty({
    example: 'clx1a2b3c4d5e6f7g8h9oit01',
    description: 'The purchased order item being reviewed (proof of purchase).',
  })
  @IsString()
  @IsNotEmpty()
  orderItemId!: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ example: 'Great fit, true to size.', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}
