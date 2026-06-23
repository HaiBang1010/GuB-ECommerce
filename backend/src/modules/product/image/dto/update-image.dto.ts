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
  @IsOptional()
  @ValidateIf((o: UpdateImageDto) => o.color !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(48)
  color?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
