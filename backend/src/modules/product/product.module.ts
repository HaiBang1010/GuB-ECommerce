import { Module } from '@nestjs/common';
import { CategoryAdminController } from './category/category-admin.controller';
import { CategoryController } from './category/category.controller';
import { CategoryService } from './category/category.service';
import { ProductAdminController } from './product/product-admin.controller';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { VariantAdminController } from './variant/variant-admin.controller';
import { VariantController } from './variant/variant.controller';
import { ProductVariantService } from './variant/variant.service';

/**
 * Catalog module. Ships the Category, Product and ProductVariant slices;
 * ProductImage / Collection slices attach here as sibling subfolders.
 *
 * Services are EXPORTED so other modules call them in-process (e.g. ProductService
 * validates categoryId via CategoryService, ProductVariantService validates
 * productId via ProductService) — never by querying the product tables directly.
 */
@Module({
  controllers: [
    CategoryController,
    CategoryAdminController,
    ProductController,
    ProductAdminController,
    VariantController,
    VariantAdminController,
  ],
  providers: [CategoryService, ProductService, ProductVariantService],
  exports: [CategoryService, ProductService, ProductVariantService],
})
export class ProductModule {}
