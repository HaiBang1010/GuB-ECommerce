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
import { Banner, Role } from '@prisma/client';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../iam/auth/supabase-auth.guard';
import { BannerResponseDto } from './dto/banner-response.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { MarketingService } from './marketing.service';

// Admin banner management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('banner')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid token.' })
@ApiForbiddenResponse({ description: 'Requires ADMIN role.' })
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/banners')
export class MarketingAdminController {
  constructor(private readonly marketing: MarketingService) {}

  @ApiOperation({ summary: 'Create a banner' })
  @ApiCreatedResponse({ type: BannerResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBannerDto): Promise<Banner> {
    return this.marketing.create(dto);
  }

  @ApiOperation({ summary: 'List all banners (incl. inactive)' })
  @ApiOkResponse({ type: [BannerResponseDto] })
  @Get()
  list(): Promise<Banner[]> {
    return this.marketing.listForAdmin();
  }

  @ApiOperation({ summary: 'Get one banner' })
  @ApiOkResponse({ type: BannerResponseDto })
  @ApiNotFoundResponse({ description: 'Banner not found.' })
  @Get(':id')
  getOne(@Param('id') id: string): Promise<Banner> {
    return this.marketing.getById(id);
  }

  @ApiOperation({ summary: 'Update a banner' })
  @ApiOkResponse({ type: BannerResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  @ApiNotFoundResponse({ description: 'Banner not found.' })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBannerDto,
  ): Promise<Banner> {
    return this.marketing.update(id, dto);
  }

  @ApiOperation({ summary: 'Archive a banner (soft delete)' })
  @ApiOkResponse({ type: BannerResponseDto })
  @ApiNotFoundResponse({ description: 'Banner not found.' })
  @Delete(':id')
  archive(@Param('id') id: string): Promise<Banner> {
    return this.marketing.archive(id);
  }
}
