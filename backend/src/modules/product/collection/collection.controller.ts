import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Collection, Product } from '@prisma/client';
import { CollectionService } from './collection.service';

// Public storefront reads — archived / out-of-window collections hidden.
@ApiTags('product')
@Controller('collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @Get()
  list(): Promise<Collection[]> {
    return this.collectionService.getActiveList();
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<Collection> {
    return this.collectionService.getActiveBySlug(slug);
  }

  @Get(':slug/products')
  getProducts(@Param('slug') slug: string): Promise<Product[]> {
    return this.collectionService.getActiveProducts(slug);
  }
}
