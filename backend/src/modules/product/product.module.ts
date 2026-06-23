import { Module } from '@nestjs/common';
import { CategoryAdminController } from './category/category-admin.controller';
import { CategoryController } from './category/category.controller';
import { CategoryService } from './category/category.service';
import { ProductAdminController } from './product/product-admin.controller';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';

/**
 * Catalog module. Ships the Category and Product slices; ProductVariant /
 * ProductImage / Collection slices attach here as sibling subfolders.
 *
 * Services are EXPORTED so other modules call them in-process (e.g. ProductService
 * validates categoryId via CategoryService) — never by querying the product
 * tables directly.
 */
@Module({
  controllers: [
    CategoryController,
    CategoryAdminController,
    ProductController,
    ProductAdminController,
  ],
  providers: [CategoryService, ProductService],
  exports: [CategoryService, ProductService],
})
export class ProductModule {}
