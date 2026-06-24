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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Category, Role } from '@prisma/client';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../modules/iam/auth/supabase-auth.guard';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// Admin catalog management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('product')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
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
