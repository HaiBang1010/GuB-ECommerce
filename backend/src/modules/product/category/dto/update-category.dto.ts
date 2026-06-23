import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

// Lowercase kebab-case: "tops", "running-shoes".
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// No PartialType (@nestjs/mapped-types is not installed) → fields are spelled out.
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameVi?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug?: string;

  // `null` explicitly moves the category to root; a string re-parents it; absent
  // leaves the parent untouched. ValidateIf lets an explicit null bypass the
  // string checks; the service distinguishes the three cases via `'parentId' in dto`.
  @IsOptional()
  @ValidateIf((o: UpdateCategoryDto) => o.parentId !== null)
  @IsString()
  @IsNotEmpty()
  parentId?: string | null;
}
