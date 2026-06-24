import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Category } from '@prisma/client';
import { CategoryService, CategoryTreeNode } from './category.service';

// Public storefront reads — no login required, archived content hidden.
@ApiTags('product')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiOperation({ summary: 'Active category tree (storefront)' })
  @Get()
  getTree(): Promise<CategoryTreeNode[]> {
    return this.categoryService.getActiveTree();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<Category> {
    return this.categoryService.getActiveBySlug(slug);
  }
}
