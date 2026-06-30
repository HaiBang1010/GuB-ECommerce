import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Category, Role } from '@prisma/client';
import { AdminCategoryResponseDto } from './dto/admin-category-response.dto';
import { CategoryResponseDto } from './dto/category-response.dto';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../modules/iam/auth/supabase-auth.guard';
import { ProductService } from '../product/product.service';
import { AdminCategory, CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// Admin catalog management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('product')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/categories')
export class CategoryAdminController {
  constructor(
    private readonly categoryService: CategoryService,
    // Product counts come from ProductService (it owns the product table); the
    // controller composes them into the category list. No service cycle:
    // ProductService → CategoryService is one-way.
    private readonly productService: ProductService,
  ) {}

  @ApiOperation({ summary: 'List all categories (incl. archived) with counts' })
  @ApiOkResponse({ type: [AdminCategoryResponseDto] })
  @Get()
  async list(): Promise<AdminCategory[]> {
    const productCounts = await this.productService.countActiveByCategory();
    return this.categoryService.listForAdmin(productCounts);
  }

  @ApiOperation({ summary: 'Get a category by id' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @Get(':id')
  getOne(@Param('id') id: string): Promise<Category> {
    return this.categoryService.findOneForAdmin(id);
  }

  @ApiOperation({ summary: 'Create a category' })
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoryService.create(dto);
  }

  @ApiOperation({ summary: 'Update a category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.update(id, dto);
  }

  @ApiOperation({ summary: 'Archive a category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string): Promise<Category> {
    return this.categoryService.archive(id);
  }

  @ApiOperation({ summary: 'Restore an archived category' })
  @ApiOkResponse({ type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Category not found.' })
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string): Promise<Category> {
    return this.categoryService.restore(id);
  }
}
