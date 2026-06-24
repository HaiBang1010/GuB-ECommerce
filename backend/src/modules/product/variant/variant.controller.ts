import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductVariant } from '@prisma/client';
import { ProductVariantService } from './variant.service';
import { VariantResponseDto } from './dto/variant-response.dto';

// Public storefront read — active variants of a visible product, by product slug.
@ApiTags('product')
@Controller('products/:slug/variants')
export class VariantController {
  constructor(private readonly variantService: ProductVariantService) {}

  @ApiOperation({ summary: 'Active variants of a product (by slug)' })
  @ApiOkResponse({ type: [VariantResponseDto] })
  @Get()
  list(@Param('slug') slug: string): Promise<ProductVariant[]> {
    return this.variantService.getActiveForProductSlug(slug);
  }
}
