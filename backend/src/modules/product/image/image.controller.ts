import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductImage } from '@prisma/client';
import { ProductImageService } from './image.service';

// Public storefront read — images of a visible product, optionally by color.
@Controller('products/:slug/images')
export class ImageController {
  constructor(private readonly imageService: ProductImageService) {}

  // `?color=Red` returns that color's images plus generic (untagged) ones.
  @Get()
  list(
    @Param('slug') slug: string,
    @Query('color') color?: string,
  ): Promise<ProductImage[]> {
    return this.imageService.getActiveForProductSlug(slug, color);
  }
}
