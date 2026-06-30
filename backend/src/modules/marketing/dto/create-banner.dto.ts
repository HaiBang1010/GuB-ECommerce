import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

// Create a home banner. The image is an external URL (admin pastes it — no upload);
// linkUrl may be a relative path (e.g. /products/foo) so it is NOT validated as a URL.
export class CreateBannerDto {
  @ApiProperty({
    example: 'https://res.cloudinary.com/demo/image/upload/v1700000000/gub/banners/summer.jpg',
    description: 'Absolute image URL (admin-provided; no upload).',
  })
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl!: string;

  @ApiPropertyOptional({
    example: '/products?category=summer',
    description: 'Click target — relative path or absolute URL. null = not clickable.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  linkUrl?: string;

  @ApiPropertyOptional({ example: 'Summer sale', description: 'Admin label / alt fallback.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    example: 'Summer sale up to 50% off',
    description: 'Image alt text (a11y).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  alt?: string;

  @ApiPropertyOptional({ example: 0, description: 'Display order (ascending).' })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ default: true, description: 'Whether the banner is shown.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
