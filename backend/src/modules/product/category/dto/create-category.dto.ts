import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Lowercase kebab-case: "tops", "running-shoes".
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameVi!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nameEn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  @Matches(SLUG_PATTERN, {
    message: 'slug must be lowercase kebab-case (letters, digits, hyphens).',
  })
  slug!: string;

  // Existence/active-state is validated in the service, not here.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  parentId?: string;
}
