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
import { Collection, Role } from '@prisma/client';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../modules/iam/auth/supabase-auth.guard';
import { CollectionService } from './collection.service';
import { CollectionProductsDto } from './dto/collection-products.dto';
import { CollectionResponseDto } from './dto/collection-response.dto';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

// Admin collection management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('product')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/collections')
export class CollectionAdminController {
  constructor(private readonly collectionService: CollectionService) {}

  @ApiOperation({ summary: 'List all collections (incl. archived)' })
  @ApiOkResponse({ type: [CollectionResponseDto] })
  @Get()
  list(): Promise<Collection[]> {
    return this.collectionService.findAllForAdmin();
  }

  @ApiOperation({ summary: 'Get a collection by id' })
  @ApiOkResponse({ type: CollectionResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found.' })
  @Get(':id')
  getOne(@Param('id') id: string): Promise<Collection> {
    return this.collectionService.findOneForAdmin(id);
  }

  @ApiOperation({ summary: 'Create a collection' })
  @ApiCreatedResponse({ type: CollectionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @Post()
  create(@Body() dto: CreateCollectionDto): Promise<Collection> {
    return this.collectionService.create(dto);
  }

  @ApiOperation({ summary: 'Update a collection' })
  @ApiOkResponse({ type: CollectionResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiNotFoundResponse({ description: 'Collection not found.' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<Collection> {
    return this.collectionService.update(id, dto);
  }

  @ApiOperation({ summary: 'Archive a collection' })
  @ApiOkResponse({ type: CollectionResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found.' })
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string): Promise<Collection> {
    return this.collectionService.archive(id);
  }

  @ApiOperation({ summary: 'Restore an archived collection' })
  @ApiOkResponse({ type: CollectionResponseDto })
  @ApiNotFoundResponse({ description: 'Collection not found.' })
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string): Promise<Collection> {
    return this.collectionService.restore(id);
  }

  // Membership (n-n) management.
  @ApiOperation({ summary: 'List product ids in a collection' })
  @ApiOkResponse({ type: [String] })
  @Get(':id/products')
  listProducts(@Param('id') id: string): Promise<string[]> {
    return this.collectionService.listProductIds(id);
  }

  @ApiOperation({ summary: 'Attach products to a collection' })
  @ApiOkResponse({ type: [String], description: 'Resulting product ids.' })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @Post(':id/products')
  @HttpCode(HttpStatus.OK)
  addProducts(
    @Param('id') id: string,
    @Body() dto: CollectionProductsDto,
  ): Promise<string[]> {
    return this.collectionService.addProducts(id, dto.productIds);
  }

  @ApiOperation({ summary: 'Detach products from a collection' })
  @ApiOkResponse({ type: [String], description: 'Resulting product ids.' })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @Delete(':id/products')
  removeProducts(
    @Param('id') id: string,
    @Body() dto: CollectionProductsDto,
  ): Promise<string[]> {
    return this.collectionService.removeProducts(id, dto.productIds);
  }
}
