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
import { Category } from '@prisma/client';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// Admin catalog management — gated by AdminGuard (backend-enforced, not UI-only).
@UseGuards(AdminGuard)
@Controller('admin/categories')
export class CategoryAdminController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  list(): Promise<Category[]> {
    return this.categoryService.findAllForAdmin();
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<Category> {
    return this.categoryService.findOneForAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoryService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.update(id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string): Promise<Category> {
    return this.categoryService.archive(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string): Promise<Category> {
    return this.categoryService.restore(id);
  }
}
