import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ProductImageService } from '../image/image.service';
import { ProductService, ProductWithPrimaryImage } from './product.service';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductResponseDto } from './dto/product-response.dto';

// Public storefront reads — no login required, archived content hidden. Each product
// is enriched with its `primaryImageUrl` (cover image) via ProductImageService, a
// controller-level compose that keeps the product↔image dependency one-way (§2.1).
@ApiTags('product')
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly imageService: ProductImageService,
  ) {}

  // Optional `?category=<slug>` narrows to one visible category; `?search=<query>`
  // runs full-text + fuzzy search; `?onSale=true`, `?sort=new` and `?limit=` drive the
  // home carousels. An empty/whitespace search falls back to the plain list.
  @ApiOperation({ summary: 'List products (?category, ?search, ?onSale, ?sort, ?limit)' })
  @ApiOkResponse({ type: [ProductResponseDto] })
  @Get()
  async list(
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductWithPrimaryImage[]> {
    const products =
      query.search !== undefined && query.search.trim() !== ''
        ? await this.productService.searchActive(query.search, query.category)
        : await this.productService.getActiveList({
            categorySlug: query.category,
            onSale: query.onSale,
            sort: query.sort,
            limit: query.limit,
          });
    return this.imageService.attachPrimaryImages(products);
  }

  @ApiOperation({ summary: 'Active product by slug' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @Get(':slug')
  async getBySlug(
    @Param('slug') slug: string,
  ): Promise<ProductWithPrimaryImage> {
    const product = await this.productService.getActiveBySlug(slug);
    return this.imageService.attachPrimaryImage(product);
  }
}
