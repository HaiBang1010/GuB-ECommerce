import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProductImage } from '@prisma/client';
import { ProductImageService } from './image.service';
import { ImageResponseDto } from './dto/image-response.dto';

// Public storefront read — images of a visible product, optionally by color.
@ApiTags('product')
@Controller('products/:slug/images')
export class ImageController {
  constructor(private readonly imageService: ProductImageService) {}

  // `?color=Red` returns that color's images plus generic (untagged) ones.
  @ApiOperation({ summary: 'Active images of a product (by slug)' })
  @ApiQuery({ name: 'color', required: false })
  @ApiOkResponse({ type: [ImageResponseDto] })
  @Get()
  list(
    @Param('slug') slug: string,
    @Query('color') color?: string,
  ): Promise<ProductImage[]> {
    return this.imageService.getActiveForProductSlug(slug, color);
  }
}
