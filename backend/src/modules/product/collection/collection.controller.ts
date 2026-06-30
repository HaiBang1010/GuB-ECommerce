import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Collection } from '@prisma/client';
import { CollectionService } from './collection.service';
import { ProductImageService } from '../image/image.service';
import { ProductWithPrimaryImage } from '../product/product.service';
import { ProductResponseDto } from '../product/dto/product-response.dto';
import { CollectionResponseDto } from './dto/collection-response.dto';

// Public storefront reads — archived / out-of-window collections hidden.
@ApiTags('product')
@Controller('collections')
export class CollectionController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly imageService: ProductImageService,
  ) {}

  @ApiOperation({ summary: 'Active collections (?featured=true → home-featured only)' })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  @ApiOkResponse({ type: [CollectionResponseDto] })
  @Get()
  list(@Query('featured') featured?: string): Promise<Collection[]> {
    return this.collectionService.getActiveList({ featured: featured === 'true' });
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
  async getProducts(
    @Param('slug') slug: string,
  ): Promise<ProductWithPrimaryImage[]> {
    const products = await this.collectionService.getActiveProducts(slug);
    return this.imageService.attachPrimaryImages(products);
  }
}
