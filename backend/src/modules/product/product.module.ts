import { Module } from '@nestjs/common';
import { CategoryAdminController } from './category/category-admin.controller';
import { CategoryController } from './category/category.controller';
import { CategoryService } from './category/category.service';

/**
 * Catalog module. Currently ships the Category slice; Product / ProductVariant /
 * ProductImage / Collection slices attach here as sibling subfolders.
 *
 * Services are EXPORTED so other modules call them in-process (e.g. a future
 * Product slice validates categoryId via CategoryService) — never by querying the
 * product tables directly.
 */
@Module({
  controllers: [CategoryController, CategoryAdminController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class ProductModule {}
