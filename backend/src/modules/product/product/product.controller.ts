import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Product } from '@prisma/client';
import { ProductService } from './product.service';
import { ProductResponseDto } from './dto/product-response.dto';

// Public storefront reads — no login required, archived content hidden.
@ApiTags('product')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Optional `?category=<slug>` narrows the list to one (visible) category.
  // Optional `?search=<query>` runs full-text + fuzzy search (combinable with
  // `category`). An empty/whitespace search falls back to the plain list.
  @ApiOperation({ summary: 'List products (optional ?category, ?search)' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiOkResponse({ type: [ProductResponseDto] })
  @Get()
  list(
    @Query('category') categorySlug?: string,
    @Query('search') search?: string,
  ): Promise<Product[]> {
    if (search !== undefined && search.trim() !== '') {
      return this.productService.searchActive(search, categorySlug);
    }
    return this.productService.getActiveList(categorySlug);
  }

  @ApiOperation({ summary: 'Active product by slug' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiNotFoundResponse({ description: 'Product not found.' })
  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<Product> {
    return this.productService.getActiveBySlug(slug);
  }
}
