import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

// Only the presentational fields are editable; url/publicId are fixed (re-upload
// to replace the asset).
export class UpdateImageDto {
  // `null` makes the image generic; a string re-tags its color; absent leaves it
  // untouched. ValidateIf lets an explicit null bypass the string checks; the
  // service distinguishes the three cases via `'color' in dto`.
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'White',
    description: 'Variant color; null makes the image generic.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateImageDto) => o.color !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  color?: string | null;

  @ApiPropertyOptional({ example: 1, description: 'Sort position.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
