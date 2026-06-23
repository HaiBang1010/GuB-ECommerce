import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Collection, Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Injectable()
export class CollectionService {
  constructor(
    private readonly prisma: PrismaService,
    // Product boundary: this service NEVER queries the product table. Membership
    // is validated/resolved through ProductService (in-process). See §4.3.
    private readonly productService: ProductService,
  ) {}

  // ---------------------------------------------------------------------------
  // Storefront (public) — archived collections, and "seasons" outside their
  // validity window, are hidden.
  // ---------------------------------------------------------------------------

  async getActiveList(): Promise<Collection[]> {
    const now = new Date();
    const active = await this.prisma.collection.findMany({
      where: { archivedAt: null },
      orderBy: { nameEn: 'asc' },
    });
    return active.filter((c) => this.isInWindow(c, now));
  }

  async getActiveBySlug(slug: string): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { slug },
    });
    if (
      !collection ||
      collection.archivedAt !== null ||
      !this.isInWindow(collection, new Date())
    ) {
      throw new NotFoundException('Collection not found.');
    }
    return collection;
  }

  // Active products of a visible collection. Product data is resolved through
  // ProductService (active + category-visible), never queried here.
  async getActiveProducts(slug: string): Promise<Product[]> {
    const collection = await this.getActiveBySlug(slug);
    const memberships = await this.prisma.productCollection.findMany({
      where: { collectionId: collection.id },
      select: { productId: true },
    });
    return this.productService.getActiveByIds(memberships.map((m) => m.productId));
  }

  // ---------------------------------------------------------------------------
  // Admin — sees everything, including archived rows and out-of-window seasons.
  // ---------------------------------------------------------------------------

  async findAllForAdmin(): Promise<Collection[]> {
    return this.prisma.collection.findMany({ orderBy: { nameEn: 'asc' } });
  }

  async findOneForAdmin(id: string): Promise<Collection> {
    return this.assertCollectionExists(id);
  }

  async create(dto: CreateCollectionDto): Promise<Collection> {
    this.assertWindow(dto.validFrom ?? null, dto.validTo ?? null);

    const data: Prisma.CollectionUncheckedCreateInput = {
      nameVi: dto.nameVi,
      nameEn: dto.nameEn,
      slug: dto.slug,
      validFrom: dto.validFrom ?? null,
      validTo: dto.validTo ?? null,
    };

    try {
      return await this.prisma.collection.create({ data });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: string, dto: UpdateCollectionDto): Promise<Collection> {
    const existing = await this.assertCollectionExists(id);

    // Validate the window against the EFFECTIVE bounds (incoming overrides
    // existing; an explicit null clears a bound).
    const nextFrom =
      'validFrom' in dto ? dto.validFrom ?? null : existing.validFrom;
    const nextTo = 'validTo' in dto ? dto.validTo ?? null : existing.validTo;
    this.assertWindow(nextFrom, nextTo);

    const data: Prisma.CollectionUpdateInput = {};
    if (dto.nameVi !== undefined) data.nameVi = dto.nameVi;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if ('validFrom' in dto) data.validFrom = dto.validFrom ?? null;
    if ('validTo' in dto) data.validTo = dto.validTo ?? null;

    try {
      return await this.prisma.collection.update({ where: { id }, data });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async archive(id: string): Promise<Collection> {
    const existing = await this.assertCollectionExists(id);
    // Idempotent: keep the original timestamp if already archived.
    if (existing.archivedAt !== null) {
      return existing;
    }
    return this.prisma.collection.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async restore(id: string): Promise<Collection> {
    await this.assertCollectionExists(id);
    return this.prisma.collection.update({
      where: { id },
      data: { archivedAt: null },
    });
  }

  // ---------------------------------------------------------------------------
  // Membership (n-n) — admin manages which products belong to a collection.
  // ---------------------------------------------------------------------------

  // Admin view of the membership: the product ids in insertion order.
  async listProductIds(collectionId: string): Promise<string[]> {
    await this.assertCollectionExists(collectionId);
    const rows = await this.prisma.productCollection.findMany({
      where: { collectionId },
      select: { productId: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => r.productId);
  }

  async addProducts(
    collectionId: string,
    productIds: string[],
  ): Promise<string[]> {
    await this.assertCollectionExists(collectionId);
    const uniqueIds = [...new Set(productIds)];
    // Validate the products through their owning service (in-process).
    await this.productService.assertManyExist(uniqueIds);

    await this.prisma.productCollection.createMany({
      data: uniqueIds.map((productId) => ({ collectionId, productId })),
      skipDuplicates: true,
    });
    return this.listProductIds(collectionId);
  }

  async removeProducts(
    collectionId: string,
    productIds: string[],
  ): Promise<string[]> {
    await this.assertCollectionExists(collectionId);
    // A membership row is a pure association (not an archivable entity), so
    // detaching is a hard delete of the join row only — no product is touched.
    await this.prisma.productCollection.deleteMany({
      where: { collectionId, productId: { in: [...new Set(productIds)] } },
    });
    return this.listProductIds(collectionId);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async assertCollectionExists(id: string): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });
    if (!collection) {
      throw new NotFoundException('Collection not found.');
    }
    return collection;
  }

  // A season is visible only inside [validFrom, validTo]; a null bound is open.
  private isInWindow(collection: Collection, now: Date): boolean {
    if (collection.validFrom !== null && collection.validFrom > now) {
      return false;
    }
    if (collection.validTo !== null && collection.validTo < now) {
      return false;
    }
    return true;
  }

  private assertWindow(from: Date | null, to: Date | null): void {
    if (from !== null && to !== null && from > to) {
      throw new BadRequestException('validFrom must be on or before validTo.');
    }
  }

  // Translate a unique-constraint hit on `slug` into 409; rethrow everything else.
  private mapWriteError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'A collection with this slug already exists.',
      );
    }
    return error instanceof Error
      ? error
      : new Error('Unknown error while writing collection.');
  }
}
