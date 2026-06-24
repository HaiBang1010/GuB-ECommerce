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
import { Product, Role } from '@prisma/client';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../modules/iam/auth/supabase-auth.guard';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// Admin catalog management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('product')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/products')
export class ProductAdminController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  list(): Promise<Product[]> {
    return this.productService.findAllForAdmin();
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<Product> {
    return this.productService.findOneForAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto): Promise<Product> {
    return this.productService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productService.update(id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string): Promise<Product> {
    return this.productService.archive(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string): Promise<Product> {
    return this.productService.restore(id);
  }
}
