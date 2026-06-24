import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Collection, Product } from '@prisma/client';
import { CollectionService } from './collection.service';
import { ProductResponseDto } from '../product/dto/product-response.dto';
import { CollectionResponseDto } from './dto/collection-response.dto';

// Public storefront reads — archived / out-of-window collections hidden.
@ApiTags('product')
@Controller('collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  @ApiOperation({ summary: 'Active collections (storefront)' })
  @ApiOkResponse({ type: [CollectionResponseDto] })
  @Get()
  list(): Promise<Collection[]> {
    return this.collectionService.getActiveList();
  }

  @ApiOperation({ summary: 'Active collection by slug' })
  @ApiOkResponse({ type: CollectionResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found.' })
  @Get(':slug')
  getBySlug(@Param('slug') slug: string): Promise<Collection> {
    return this.collectionService.getActiveBySlug(slug);
  }

  @ApiOperation({ summary: 'Active products in a collection' })
  @ApiOkResponse({ type: [ProductResponseDto] })
  @ApiNotFoundResponse({ description: 'Collection not found.' })
  @Get(':slug/products')
  getProducts(@Param('slug') slug: string): Promise<Product[]> {
    return this.collectionService.getActiveProducts(slug);
  }
}
