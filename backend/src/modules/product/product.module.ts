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
import { CollectionAdminController } from './collection/collection-admin.controller';
import { CollectionController } from './collection/collection.controller';
import { CollectionService } from './collection/collection.service';

/**
 * Catalog module. Ships the Category, Product, ProductVariant and Collection
 * slices; the ProductImage slice attaches here as a sibling subfolder.
 *
 * Services are EXPORTED so other modules call them in-process (e.g. ProductService
 * validates categoryId via CategoryService; ProductVariantService and
 * CollectionService validate productId via ProductService) — never by querying
 * the product tables directly.
 */
@Module({
  controllers: [
    CategoryController,
    CategoryAdminController,
    ProductController,
    ProductAdminController,
    VariantController,
    VariantAdminController,
    CollectionController,
    CollectionAdminController,
  ],
  providers: [
    CategoryService,
    ProductService,
    ProductVariantService,
    CollectionService,
  ],
  exports: [
    CategoryService,
    ProductService,
    ProductVariantService,
    CollectionService,
  ],
})
export class ProductModule {}
