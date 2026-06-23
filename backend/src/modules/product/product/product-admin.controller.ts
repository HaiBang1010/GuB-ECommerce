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
import { Product } from '@prisma/client';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// Admin catalog management — gated by AdminGuard (backend-enforced, not UI-only).
@UseGuards(AdminGuard)
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
