import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Collection, Role } from '@prisma/client';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../modules/iam/auth/supabase-auth.guard';
import { CollectionService } from './collection.service';
import { CollectionProductsDto } from './dto/collection-products.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

// Admin collection management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/collections')
export class CollectionAdminController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  list(): Promise<Collection[]> {
    return this.collectionService.findAllForAdmin();
  }

  @Get(':id')
  getOne(@Param('id') id: string): Promise<Collection> {
    return this.collectionService.findOneForAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateCollectionDto): Promise<Collection> {
    return this.collectionService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<Collection> {
    return this.collectionService.update(id, dto);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string): Promise<Collection> {
    return this.collectionService.archive(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string): Promise<Collection> {
    return this.collectionService.restore(id);
  }

  // Membership (n-n) management.
  @Get(':id/products')
  listProducts(@Param('id') id: string): Promise<string[]> {
    return this.collectionService.listProductIds(id);
  }

  @Post(':id/products')
  @HttpCode(HttpStatus.OK)
  addProducts(
    @Param('id') id: string,
    @Body() dto: CollectionProductsDto,
  ): Promise<string[]> {
    return this.collectionService.addProducts(id, dto.productIds);
  }

  @Delete(':id/products')
  removeProducts(
    @Param('id') id: string,
    @Body() dto: CollectionProductsDto,
  ): Promise<string[]> {
    return this.collectionService.removeProducts(id, dto.productIds);
  }
}
