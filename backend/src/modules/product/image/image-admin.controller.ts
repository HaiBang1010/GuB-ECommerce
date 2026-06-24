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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductImage, Role } from '@prisma/client';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { SupabaseAuthGuard } from '../../../modules/iam/auth/supabase-auth.guard';
import { SignedUpload } from './cloudinary.service';
import { CreateImageDto } from './dto/create-image.dto';
import { SignUploadDto } from './dto/sign-upload.dto';
import { UpdateImageDto } from './dto/update-image.dto';
import { ProductImageService } from './image.service';

// Admin image management — Supabase JWT + ADMIN role (backend-enforced, not UI-only).
@ApiTags('product')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/product-images')
export class ImageAdminController {
  constructor(private readonly imageService: ProductImageService) {}

  // Step 1: signed params; the browser then uploads the file straight to Cloudinary.
  @Post('sign')
  @HttpCode(HttpStatus.OK)
  sign(@Body() dto: SignUploadDto): Promise<SignedUpload> {
    return this.imageService.sign(dto.productId);
  }

  // Step 2: persist the resulting asset (secure_url + public_id).
  @Post()
  create(@Body() dto: CreateImageDto): Promise<ProductImage> {
    return this.imageService.create(dto);
  }

  @Get()
  list(@Query('productId') productId: string): Promise<ProductImage[]> {
    return this.imageService.listForAdmin(productId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateImageDto,
  ): Promise<ProductImage> {
    return this.imageService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.imageService.remove(id);
  }
}
