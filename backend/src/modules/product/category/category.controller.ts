import { Controller, Get, Param } from '@nestjs/common';
import { Category } from '@prisma/client';
import { CategoryService, CategoryTreeNode } from './category.service';

// Public storefront reads — no login required, archived content hidden.
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  getTree(): Promise<CategoryTreeNode[]> {
    return this.categoryService.getActiveTree();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<Category> {
    return this.categoryService.getActiveBySlug(slug);
  }
}
