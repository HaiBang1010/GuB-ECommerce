import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product, ProductVariant } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { GenerateVariantsDto } from './dto/generate-variants.dto';
import { UpdateVariantDto } from './dto/update-variant.dto';

// Result of a matrix generation: how many rows were inserted plus the full
// current variant list for the product (so the admin grid can re-render).
export type GenerateResult = {
  createdCount: number;
  variants: ProductVariant[];
};

// A variant + quantity for an in-transaction stock movement (decrement/release).
export interface StockChange {
  variantId: string;
  quantity: number;
}

// A purchasable variant enriched with the sale-aware price actually charged.
// `effectivePriceCents` already folds in the owning product's sale (see
// ProductVariantService.effectivePrice); the cart/order consume it so the sale
// is applied at checkout, not just displayed.
export type PurchasableVariant = ProductVariant & {
  effectivePriceCents: number;
};

// Discriminator on the 409 body so the storefront can tell an out-of-stock
// rejection apart from a payment failure. Mirrored by OutOfStockErrorDto.
export const OUT_OF_STOCK_CODE = 'OUT_OF_STOCK';

// One variant that couldn't be fully reserved + how many are actually left.
export interface OutOfStockItem {
  variantId: string;
  available: number;
}

@Injectable()
export class ProductVariantService {
  constructor(
    private readonly prisma: PrismaService,
    // Product boundary: this service NEVER queries the product table. It asks
    // ProductService (in-process) to validate/resolve products. See §4.3.
    private readonly productService: ProductService,
  ) {}

  // ---------------------------------------------------------------------------
  // Storefront (public) — only active variants of a visible product. Product +
  // category visibility is decided by ProductService.getActiveBySlug.
  // ---------------------------------------------------------------------------

  async getActiveForProductSlug(slug: string): Promise<ProductVariant[]> {
    const product = await this.productService.getActiveBySlug(slug);
    return this.prisma.productVariant.findMany({
      where: { productId: product.id, archivedAt: null },
      orderBy: [{ size: 'asc' }, { color: 'asc' }],
    });
  }

  // ---------------------------------------------------------------------------
  // Admin — sees everything, including archived rows.
  // ---------------------------------------------------------------------------

  async listForAdmin(productId: string): Promise<ProductVariant[]> {
    await this.productService.assertExists(productId);
    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ size: 'asc' }, { color: 'asc' }],
    });
  }

  async create(dto: CreateVariantDto): Promise<ProductVariant> {
    // Validate the product through its owning service (in-process).
    await this.productService.assertExists(dto.productId);

    const data: Prisma.ProductVariantUncheckedCreateInput = {
      productId: dto.productId,
      sku: dto.sku,
      size: dto.size,
      color: dto.color,
      priceCents: dto.priceCents,
      stockQty: dto.stockQty ?? 0,
    };

    try {
      return await this.prisma.productVariant.create({ data });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async update(id: string, dto: UpdateVariantDto): Promise<ProductVariant> {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Variant not found.');
    }

    const data: Prisma.ProductVariantUpdateInput = {};
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.size !== undefined) data.size = dto.size;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.priceCents !== undefined) data.priceCents = dto.priceCents;
    if (dto.stockQty !== undefined) data.stockQty = dto.stockQty;

    try {
      return await this.prisma.productVariant.update({ where: { id }, data });
    } catch (error) {
      throw this.mapWriteError(error);
    }
  }

  async archive(id: string): Promise<ProductVariant> {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Variant not found.');
    }
    // Idempotent: keep the original timestamp if already archived.
    if (existing.archivedAt !== null) {
      return existing;
    }
    return this.prisma.productVariant.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
  }

  async restore(id: string): Promise<ProductVariant> {
    const existing = await this.prisma.productVariant.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Variant not found.');
    }
    return this.prisma.productVariant.update({
      where: { id },
      data: { archivedAt: null },
    });
  }

  // Bulk-generate the size×color matrix. Combos that already exist for the
  // product are skipped (so the admin can add new sizes/colors later); each new
  // combo gets an auto SKU namespaced by the product, making cross-product SKU
  // collisions impossible.
  async generate(dto: GenerateVariantsDto): Promise<GenerateResult> {
    const product = await this.productService.assertExists(dto.productId);
    const prefix = this.skuToken(dto.skuPrefix ?? product.slug);

    const sizes = this.dedupe(dto.sizes);
    const colors = this.dedupe(dto.colors);

    // Existing (size,color) combos for this product → skip them.
    const existing = await this.prisma.productVariant.findMany({
      where: { productId: dto.productId },
      select: { size: true, color: true },
    });
    const existingCombo = new Set(
      existing.map((v) => this.comboKey(v.size, v.color)),
    );

    const rows: Prisma.ProductVariantCreateManyInput[] = [];
    for (const size of sizes) {
      for (const color of colors) {
        if (existingCombo.has(this.comboKey(size, color))) continue;
        rows.push({
          productId: dto.productId,
          sku: `${prefix}-${this.skuToken(size)}-${this.skuToken(color)}`,
          size,
          color,
          priceCents: dto.priceCents,
          stockQty: dto.stockQty ?? 0,
        });
      }
    }

    let createdCount = 0;
    if (rows.length > 0) {
      // skipDuplicates is a safety net against a rare SKU collision; the
      // (productId,size,color) combos are already filtered out above.
      const result = await this.prisma.productVariant.createMany({
        data: rows,
        skipDuplicates: true,
      });
      createdCount = result.count;
    }

    const variants = await this.prisma.productVariant.findMany({
      where: { productId: dto.productId },
      orderBy: [{ size: 'asc' }, { color: 'asc' }],
    });
    return { createdCount, variants };
  }

  // ---------------------------------------------------------------------------
  // Cross-module API — called IN-PROCESS by sibling modules (cart, ordering) to
  // resolve variants a customer may purchase WITHOUT querying the product tables
  // directly. A purchasable variant is active AND belongs to a storefront-visible
  // product (visibility decided by ProductService). See ARCHITECTURE.md §4.3.
  // ---------------------------------------------------------------------------

  async getPurchasableByIds(
    variantIds: string[],
  ): Promise<PurchasableVariant[]> {
    if (variantIds.length === 0) return [];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, archivedAt: null },
    });
    if (variants.length === 0) return [];
    // Resolve product visibility through ProductService (the archive cascade),
    // never by querying the product table here. The resolved products also carry
    // the sale price, so the effective (charged) price is computed here for free.
    const productIds = [...new Set(variants.map((v) => v.productId))];
    const visibleProducts = await this.productService.getActiveByIds(productIds);
    const productById = new Map(visibleProducts.map((p) => [p.id, p]));
    return variants
      .filter((v) => productById.has(v.productId))
      .map((v) => ({
        ...v,
        // productById.get is non-null here — filtered to visible products above.
        effectivePriceCents: this.effectivePrice(v, productById.get(v.productId)!),
      }));
  }

  async getPurchasable(variantId: string): Promise<PurchasableVariant> {
    const [variant] = await this.getPurchasableByIds([variantId]);
    if (!variant) {
      throw new NotFoundException('Variant not found.');
    }
    return variant;
  }

  // Atomic stock decrement — the stock-race fix (ARCHITECTURE §5.1). Runs inside
  // the caller's transaction (ordering owns the tx, product owns the table) so a
  // failed order rolls the stock back automatically. The `stockQty >= quantity`
  // guard makes overselling impossible: a losing concurrent buyer matches 0 rows.
  async decrementForOrder(
    tx: Prisma.TransactionClient,
    items: StockChange[],
  ): Promise<void> {
    // Apply every atomic decrement, collecting the items that can't be satisfied
    // (rather than throwing on the first). The thrown transaction rolls back any
    // decrements that DID apply, so atomicity holds while the error can name the
    // full failing set + each variant's available quantity for the storefront.
    const insufficient: OutOfStockItem[] = [];
    for (const { variantId, quantity } of items) {
      const result = await tx.productVariant.updateMany({
        where: { id: variantId, archivedAt: null, stockQty: { gte: quantity } },
        data: { stockQty: { decrement: quantity } },
      });
      if (result.count !== 1) {
        const variant = await tx.productVariant.findUnique({
          where: { id: variantId },
          select: { stockQty: true },
        });
        insufficient.push({ variantId, available: variant?.stockQty ?? 0 });
      }
    }
    if (insufficient.length > 0) {
      // Structured body so the storefront can distinguish out-of-stock from a
      // payment error and show "<name> — only N left". Shape mirrors
      // OutOfStockErrorDto (order module) — keep the two in sync.
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'Insufficient stock for one or more items.',
        code: OUT_OF_STOCK_CODE,
        items: insufficient,
      });
    }
  }

  // Return stock to the shelf on cancellation / payment failure / expiry. Runs in
  // the caller's transaction. No guard needed — incrementing is always safe.
  async releaseForOrder(
    tx: Prisma.TransactionClient,
    items: StockChange[],
  ): Promise<void> {
    for (const { variantId, quantity } of items) {
      await tx.productVariant.updateMany({
        where: { id: variantId },
        data: { stockQty: { increment: quantity } },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  // The unit price actually charged for a variant. Sale never RAISES the price:
  // the product-level sale applies only when it undercuts the variant's own price
  // (a variant cheaper than the sale keeps its price). null sale = not on sale.
  private effectivePrice(variant: ProductVariant, product: Product): number {
    const sale = product.salePriceCents;
    return sale !== null && sale < variant.priceCents ? sale : variant.priceCents;
  }

  // Normalize a free-text size/color/prefix into an SKU token: uppercase, and
  // collapse any run of non-alphanumerics to a single hyphen ("Navy Blue" → "NAVY-BLUE").
  private skuToken(value: string): string {
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // NUL separator can't appear in the free-text inputs, so distinct (size,color)
  // pairs never collide into the same key.
  private comboKey(size: string, color: string): string {
    return `${size} ${color}`;
  }

  private dedupe(values: string[]): string[] {
    return [...new Set(values)];
  }

  // Map a unique-constraint hit to 409, distinguishing the SKU constraint from
  // the (productId, size, color) combo constraint via the error target.
  private mapWriteError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = error.meta?.target;
      const onSku = Array.isArray(target)
        ? target.includes('sku')
        : typeof target === 'string' && target.includes('sku');
      return new ConflictException(
        onSku
          ? 'A variant with this SKU already exists.'
          : 'A variant with this size and color already exists for the product.',
      );
    }
    return error instanceof Error
      ? error
      : new Error('Unknown error while writing variant.');
  }
}
