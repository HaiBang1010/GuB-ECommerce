import { Controller, Get, Param, Query } from '@nestjs/common';
import { Product } from '@prisma/client';
import { ProductService } from './product.service';

// Public storefront reads — no login required, archived content hidden.
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Optional `?category=<slug>` narrows the list to one (visible) category.
  @Get()
  list(@Query('category') categorySlug?: string): Promise<Product[]> {
    return this.productService.getActiveList(categorySlug);
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<Product> {
    return this.productService.getActiveBySlug(slug);
  }
}
