import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductImage } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { CloudinaryService, SignedUpload } from './cloudinary.service';
import { CreateImageDto } from './dto/create-image.dto';
import { UpdateImageDto } from './dto/update-image.dto';

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Product boundary: this service NEVER queries the product table. It asks
    // ProductService (in-process) to validate/resolve products. See §4.3.
    private readonly productService: ProductService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  // ---------------------------------------------------------------------------
  // Storefront (public) — images of a visible product, optionally by color.
  // ---------------------------------------------------------------------------

  async getActiveForProductSlug(
    slug: string,
    color?: string,
  ): Promise<ProductImage[]> {
    const product = await this.productService.getActiveBySlug(slug);
    return this.prisma.productImage.findMany({
      where: {
        productId: product.id,
        // A specific color shows that color's images PLUS generic (null) images.
        ...(color !== undefined ? { OR: [{ color }, { color: null }] } : {}),
      },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }

  // ---------------------------------------------------------------------------
  // Admin — sees everything.
  // ---------------------------------------------------------------------------

  // Step 1 of the upload: signed params for a direct browser→Cloudinary upload.
  async sign(productId: string): Promise<SignedUpload> {
    await this.productService.assertExists(productId);
    return this.cloudinary.signUpload(productId);
  }

  async listForAdmin(productId: string): Promise<ProductImage[]> {
    await this.productService.assertExists(productId);
    return this.prisma.productImage.findMany({
      where: { productId },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
  }

  // Step 2 of the upload: persist the resulting asset.
  async create(dto: CreateImageDto): Promise<ProductImage> {
    await this.productService.assertExists(dto.productId);

    // Only accept secure_urls that belong to our Cloudinary account.
    const prefix = this.cloudinary.expectedUrlPrefix();
    if (!dto.url.startsWith(prefix)) {
      throw new BadRequestException(
        'url must be a Cloudinary asset from this account.',
      );
    }

    const data: Prisma.ProductImageUncheckedCreateInput = {
      productId: dto.productId,
      url: dto.url,
      publicId: dto.publicId,
      color: dto.color ?? null,
      position: dto.position ?? 0,
    };

    try {
      return await this.prisma.productImage.create({ data });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: string, dto: UpdateImageDto): Promise<ProductImage> {
    const existing = await this.prisma.productImage.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Image not found.');
    }

    const data: Prisma.ProductImageUpdateInput = {};
    if ('color' in dto) data.color = dto.color ?? null;
    if (dto.position !== undefined) data.position = dto.position;

    return this.prisma.productImage.update({ where: { id }, data });
  }

  // Delete the remote asset FIRST, then the row. A remote failure must NOT strand
  // the DB row: log it and remove the row anyway.
  async remove(id: string): Promise<void> {
    const existing = await this.prisma.productImage.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Image not found.');
    }

    try {
      await this.cloudinary.destroy(existing.publicId);
    } catch (error) {
      this.logger.error(
        `Failed to delete Cloudinary asset "${existing.publicId}"; removing DB row anyway.`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    await this.prisma.productImage.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  // Translate a unique-constraint hit on `publicId` into 409; rethrow the rest.
  private mapWriteError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'An image with this Cloudinary public id already exists.',
      );
    }
    return error instanceof Error
      ? error
      : new Error('Unknown error while writing image.');
  }
}
