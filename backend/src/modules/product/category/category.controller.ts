import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Category } from '@prisma/client';
import { CategoryService, CategoryTreeNode } from './category.service';
import {
  CategoryResponseDto,
  CategoryTreeNodeDto,
} from './dto/category-response.dto';

// Public storefront reads — no login required, archived content hidden.
@ApiTags('product')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiOperation({ summary: 'Active category tree (storefront)' })
  @ApiOkResponse({ type: [CategoryTreeNodeDto] })
  @Get()
  getTree(): Promise<CategoryTreeNode[]> {
    return this.categoryService.getActiveTree();
  }

  @ApiOperation({ summary: 'Active category by slug' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<Category> {
    return this.categoryService.getActiveBySlug(slug);
  }
}
