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
import { CloudinaryService } from './image/cloudinary.service';
import { ImageAdminController } from './image/image-admin.controller';
import { ImageController } from './image/image.controller';
import { ProductImageService } from './image/image.service';
import { SizeSuggestionController } from './size/size-suggestion.controller';
import { SizeSuggestionService } from './size/size-suggestion.service';

/**
 * Catalog module. Ships the Category, Product, ProductVariant, Collection and
 * ProductImage slices — the full Phase 1 catalog.
 *
 * Services are EXPORTED so other modules call them in-process (e.g. ProductService
 * validates categoryId via CategoryService; ProductVariantService,
 * CollectionService and ProductImageService validate productId via
 * ProductService) — never by querying the product tables directly.
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
    ImageController,
    ImageAdminController,
    SizeSuggestionController,
  ],
  providers: [
    CategoryService,
    ProductService,
    ProductVariantService,
    CollectionService,
    CloudinaryService,
    ProductImageService,
    SizeSuggestionService,
  ],
  exports: [
    CategoryService,
    ProductService,
    ProductVariantService,
    CollectionService,
    ProductImageService,
  ],
})
export class ProductModule {}
