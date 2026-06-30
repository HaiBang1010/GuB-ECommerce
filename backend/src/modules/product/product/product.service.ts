import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CategoryService } from '../category/category.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    // Category boundary: this service NEVER queries the category table. It asks
    // CategoryService (in-process) to validate/resolve categories. See §4.3.
    private readonly categoryService: CategoryService,
  ) {}

  // ---------------------------------------------------------------------------
  // Storefront (public) — archived products, and products whose category (or an
  // ancestor) is archived, are hidden. Category visibility is decided by
  // CategoryService, mirroring the category cascade-at-read-time philosophy.
  // ---------------------------------------------------------------------------

  async getActiveList(categorySlug?: string): Promise<Product[]> {
    if (categorySlug !== undefined) {
      // getActiveBySlug resolves visibility too: it throws 404 when the category
      // or any ancestor is archived, so an invisible category yields no listing.
      const category = await this.categoryService.getActiveBySlug(categorySlug);
      return this.prisma.product.findMany({
        where: { archivedAt: null, categoryId: category.id },
        orderBy: { nameEn: 'asc' },
      });
    }

    const products = await this.prisma.product.findMany({
      where: { archivedAt: null },
      orderBy: { nameEn: 'asc' },
    });
    const visibleCategoryIds = await this.categoryService.getVisibleCategoryIds();
    return products.filter((p) => visibleCategoryIds.has(p.categoryId));
  }

  // Cross-module (in-process): active product counts keyed by categoryId. The admin
  // category list uses it to warn what an archive would hide. ProductService owns the
  // product table, so CategoryService asks here instead of querying it (§4.3).
  async countActiveByCategory(): Promise<Record<string, number>> {
    const grouped = await this.prisma.product.groupBy({
      by: ['categoryId'],
      where: { archivedAt: null },
      _count: { _all: true },
    });
    return Object.fromEntries(
      grouped.map((g) => [g.categoryId, g._count._all]),
    );
  }

  async getActiveBySlug(slug: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product || product.archivedAt !== null) {
      throw new NotFoundException('Product not found.');
    }
    // Cascade: a product under an archived category (or ancestor) is hidden.
    const visible = await this.categoryService.isCategoryVisible(
      product.categoryId,
    );
    if (!visible) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }

  // Full-text + fuzzy storefront search. Accent-insensitive: the `product.gub_vn`
  // text-search config folds accents on BOTH sides (stored tsvector + the query),
  // so "ao thun" finds "Áo thun". A pg_trgm fallback on accent-folded names tolerates
  // typos the tsquery misses. Ranking: ts_rank first, then trigram similarity.
  // Raw SQL is required (Prisma cannot express tsquery / trgm operators); we select
  // ids only, then re-fetch typed rows so the result is a clean Product[] and the
  // tsvector column never leaks out. Category visibility (the archive cascade) is
  // applied in-process via CategoryService, exactly like getActiveList — no
  // cross-schema join.
  async searchActive(
    rawQuery: string,
    categorySlug?: string,
  ): Promise<Product[]> {
    const q = rawQuery.trim();
    if (q === '') return [];

    let categoryId: string | undefined;
    if (categorySlug !== undefined) {
      // Throws 404 when the category (or an ancestor) is archived → no results.
      const category = await this.categoryService.getActiveBySlug(categorySlug);
      categoryId = category.id;
    }

    const matches = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT id
        FROM product."Product"
        WHERE "archivedAt" IS NULL
          ${categoryId ? Prisma.sql`AND "categoryId" = ${categoryId}` : Prisma.empty}
          AND (
            "search_tsv" @@ websearch_to_tsquery('product.gub_vn', ${q})
            OR product.f_unaccent("nameVi") % product.f_unaccent(${q})
            OR product.f_unaccent("nameEn") % product.f_unaccent(${q})
          )
        ORDER BY
          ts_rank("search_tsv", websearch_to_tsquery('product.gub_vn', ${q})) DESC,
          GREATEST(
            similarity(product.f_unaccent("nameVi"), product.f_unaccent(${q})),
            similarity(product.f_unaccent("nameEn"), product.f_unaccent(${q}))
          ) DESC
        LIMIT 50
      `,
    );
    if (matches.length === 0) return [];

    const orderedIds = matches.map((m) => m.id);
    const products = await this.prisma.product.findMany({
      where: { id: { in: orderedIds } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    // Narrowing by slug already guarantees a visible category; otherwise filter the
    // whole result against the set of storefront-visible category ids.
    const visible = categoryId
      ? null
      : await this.categoryService.getVisibleCategoryIds();

    // Re-apply the rank order from the raw query (findMany does not preserve it).
    return orderedIds
      .map((id) => byId.get(id))
      .filter(
        (p): p is Product =>
          p !== undefined && (visible === null || visible.has(p.categoryId)),
      );
  }

  // ---------------------------------------------------------------------------
  // Admin — sees everything, including archived rows.
  // ---------------------------------------------------------------------------

  async findAllForAdmin(): Promise<Product[]> {
    return this.prisma.product.findMany({ orderBy: { nameEn: 'asc' } });
  }

  async findOneForAdmin(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    // Validate the category through its owning service (in-process), never by
    // querying the category table from here.
    await this.categoryService.assertActive(dto.categoryId);
    this.assertPricing(dto.basePriceCents, dto.salePriceCents ?? null);

    const data: Prisma.ProductUncheckedCreateInput = {
      categoryId: dto.categoryId,
      nameVi: dto.nameVi,
      nameEn: dto.nameEn,
      slug: dto.slug,
      descriptionVi: dto.descriptionVi ?? null,
      descriptionEn: dto.descriptionEn ?? null,
      brand: dto.brand ?? null,
      basePriceCents: dto.basePriceCents,
      salePriceCents: dto.salePriceCents ?? null,
    };

    try {
      return await this.prisma.product.create({ data });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found.');
    }

    if (dto.categoryId !== undefined) {
      await this.categoryService.assertActive(dto.categoryId);
    }

    // Validate pricing against the EFFECTIVE values (incoming overrides existing).
    const nextBase = dto.basePriceCents ?? existing.basePriceCents;
    const nextSale =
      'salePriceCents' in dto
        ? dto.salePriceCents ?? null
        : existing.salePriceCents;
    this.assertPricing(nextBase, nextSale);

    const data: Prisma.ProductUpdateInput = {};
    if (dto.nameVi !== undefined) data.nameVi = dto.nameVi;
    if (dto.nameEn !== undefined) data.nameEn = dto.nameEn;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.descriptionVi !== undefined) data.descriptionVi = dto.descriptionVi;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
    if (dto.brand !== undefined) data.brand = dto.brand;
    if (dto.basePriceCents !== undefined) {
      data.basePriceCents = dto.basePriceCents;
    }
    // `null` clears the sale; a number sets it; absent leaves it untouched.
    if ('salePriceCents' in dto) data.salePriceCents = dto.salePriceCents ?? null;
    if (dto.categoryId !== undefined) {
      data.category = { connect: { id: dto.categoryId } };
    }

    try {
      return await this.prisma.product.update({ where: { id }, data });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async archive(id: string): Promise<Product> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found.');
    }
    // Idempotent: keep the original timestamp if already archived.
    if (existing.archivedAt !== null) {
      return existing;
    }
    return this.prisma.product.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async restore(id: string): Promise<Product> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Product not found.');
    }
    // Note: a restored product stays hidden on the storefront while its category
    // is archived — correct, since visibility is decided by the category chain.
    return this.prisma.product.update({
      where: { id },
      data: { archivedAt: null },
    });
  }

  // ---------------------------------------------------------------------------
  // Cross-slice API — called IN-PROCESS by sibling slices (e.g. variant) so they
  // validate a productId WITHOUT querying the product table directly. Mirrors how
  // this service leans on CategoryService. See ARCHITECTURE.md §4.3.
  // ---------------------------------------------------------------------------

  // Resolve a product by id for an admin write (archived rows included — admin
  // manages everything). Throws 400 when the id does not exist.
  async assertExists(productId: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new BadRequestException('Product does not exist.');
    }
    return product;
  }

  // Validate a batch of product ids in one query (used when a sibling slice
  // attaches products, e.g. collection membership). Throws 400 listing any
  // unknown ids. Archived rows count as existing — admin manages everything.
  async assertManyExist(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;
    const found = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((p) => p.id));
    const missing = productIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Unknown product id(s): ${missing.join(', ')}`,
      );
    }
  }

  // Storefront resolution of many products by id: keeps only active products
  // whose category is visible. Used in-process by sibling slices that hold a set
  // of product ids (e.g. collection membership) but must not query products.
  async getActiveByIds(productIds: string[]): Promise<Product[]> {
    if (productIds.length === 0) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, archivedAt: null },
      orderBy: { nameEn: 'asc' },
    });
    const visibleCategoryIds = await this.categoryService.getVisibleCategoryIds();
    return products.filter((p) => visibleCategoryIds.has(p.categoryId));
  }

  // Admin batch resolution of products by id — INCLUDES archived/hidden products
  // and applies no category-visibility filter, because admin enrichment (e.g. the
  // reviews list) must show the product name even after it was archived. Callers
  // map the result by id; the boundary stays a service call (no cross-schema JOIN).
  async findManyByIds(productIds: string[]): Promise<Product[]> {
    if (productIds.length === 0) return [];
    return this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  // A sale price must undercut the base price (both already validated >= 0 by the
  // DTO). null = not on sale.
  private assertPricing(baseCents: number, saleCents: number | null): void {
    if (saleCents !== null && saleCents >= baseCents) {
      throw new BadRequestException(
        'salePriceCents must be lower than basePriceCents.',
      );
    }
  }

  // Translate a unique-constraint hit on `slug` into 409; rethrow everything else.
  private mapWriteError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('A product with this slug already exists.');
    }
    return error instanceof Error
      ? error
      : new Error('Unknown error while writing product.');
  }
}
