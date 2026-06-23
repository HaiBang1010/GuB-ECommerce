import { Controller, Get, Param } from '@nestjs/common';
import { ProductVariant } from '@prisma/client';
import { ProductVariantService } from './variant.service';

// Public storefront read — active variants of a visible product, by product slug.
@Controller('products/:slug/variants')
export class VariantController {
  constructor(private readonly variantService: ProductVariantService) {}

  @Get()
  list(@Param('slug') slug: string): Promise<ProductVariant[]> {
    return this.variantService.getActiveForProductSlug(slug);
  }
}
