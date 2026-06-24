import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
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
import { ProductVariant, Role } from '@prisma/client';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../modules/iam/auth/supabase-auth.guard';
import { CreateVariantDto } from './dto/create-variant.dto';
import { GenerateVariantsDto } from './dto/generate-variants.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';
import {
  GenerateVariantsResultDto,
  VariantResponseDto,
} from './dto/variant-response.dto';
import { GenerateResult, ProductVariantService } from './variant.service';

// Admin variant management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('product')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/product-variants')
export class VariantAdminController {
  constructor(private readonly variantService: ProductVariantService) {}

  // `?productId=...` — all variants (incl. archived) of one product.
  @ApiOperation({ summary: 'List a product variants (incl. archived)' })
  @ApiOkResponse({ type: [VariantResponseDto] })
  @Get()
  list(@Query('productId') productId: string): Promise<ProductVariant[]> {
    return this.variantService.listForAdmin(productId);
  }

  @ApiOperation({ summary: 'Create a variant' })
  @ApiCreatedResponse({ type: VariantResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @Post()
  create(@Body() dto: CreateVariantDto): Promise<ProductVariant> {
    return this.variantService.create(dto);
  }

  // Bulk-generate the size×color matrix for a product.
  @ApiOperation({ summary: 'Bulk-generate the size×color matrix' })
  @ApiOkResponse({ type: GenerateVariantsResultDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: GenerateVariantsDto): Promise<GenerateResult> {
    return this.variantService.generate(dto);
  }

  @ApiOperation({ summary: 'Update a variant' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiNotFoundResponse({ description: 'Variant not found.' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVariantDto,
  ): Promise<ProductVariant> {
    return this.variantService.update(id, dto);
  }

  @ApiOperation({ summary: 'Archive a variant' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiNotFoundResponse({ description: 'Variant not found.' })
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id') id: string): Promise<ProductVariant> {
    return this.variantService.archive(id);
  }

  @ApiOperation({ summary: 'Restore an archived variant' })
  @ApiOkResponse({ type: VariantResponseDto })
  @ApiNotFoundResponse({ description: 'Variant not found.' })
  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(@Param('id') id: string): Promise<ProductVariant> {
    return this.variantService.restore(id);
  }
}
