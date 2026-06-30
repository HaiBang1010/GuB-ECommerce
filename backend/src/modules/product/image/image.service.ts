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

  // Cover-image resolution for product lists (home carousels, grid). Returns a
  // productId -> cover URL map: the lowest-position image, preferring a generic
  // (color = null) image over a color-specific one. Owns the ProductImage table, so
  // sibling slices/controllers compose this instead of querying images themselves.
  async getPrimaryImageUrls(
    productIds: string[],
  ): Promise<Map<string, string>> {
    if (productIds.length === 0) return new Map();
    const images = await this.prisma.productImage.findMany({
      where: { productId: { in: productIds } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    });
    const generic = new Map<string, string>(); // first generic (color=null) image
    const anyImage = new Map<string, string>(); // first image of any color (fallback)
    for (const img of images) {
      if (!anyImage.has(img.productId)) anyImage.set(img.productId, img.url);
      if (img.color === null && !generic.has(img.productId)) {
        generic.set(img.productId, img.url);
      }
    }
    const result = new Map<string, string>();
    for (const id of productIds) {
      const url = generic.get(id) ?? anyImage.get(id);
      if (url !== undefined) result.set(id, url);
    }
    return result;
  }

  // Attach `primaryImageUrl` to each product row. Controller-compose helper: keeps the
  // product↔image edge one-way (this service already depends on ProductService, so
  // ProductService must not depend back on it). See ARCHITECTURE.md §2.1 / §4.3.
  async attachPrimaryImages<T extends { id: string }>(
    products: T[],
  ): Promise<Array<T & { primaryImageUrl: string | null }>> {
    const urls = await this.getPrimaryImageUrls(products.map((p) => p.id));
    return products.map((p) => ({
      ...p,
      primaryImageUrl: urls.get(p.id) ?? null,
    }));
  }

  async attachPrimaryImage<T extends { id: string }>(
    product: T,
  ): Promise<T & { primaryImageUrl: string | null }> {
    const [withImage] = await this.attachPrimaryImages([product]);
    return withImage;
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
