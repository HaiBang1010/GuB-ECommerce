import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cart, CartItem, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductVariantService } from '../product/variant/variant.service';

// A cart belongs to either a signed-in user or an anonymous guest session.
// Exactly one branch is set (mirrors the Cart.userId / Cart.sessionId columns).
export type CartOwner = { userId: string } | { sessionId: string };

// A cart line enriched with LIVE variant data for display. This is NOT an order
// snapshot — prices here always reflect the current catalog (the immutable
// snapshot happens at checkout, ARCHITECTURE §4.4).
export interface CartItemView {
  variantId: string;
  productId: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  unitPriceCents: number;
  lineCents: number;
  stockQty: number;
}

export interface CartView {
  items: CartItemView[];
  subtotalCents: number;
}

const EMPTY_VIEW: CartView = { items: [], subtotalCents: 0 };

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    // Product boundary: the cart NEVER queries product tables. It resolves
    // variants (validity, live price, stock) via ProductVariantService in-process.
    private readonly variants: ProductVariantService,
  ) {}

  async getView(owner: CartOwner): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({
      where: this.ownerWhere(owner),
      include: { items: true },
    });
    return this.buildView(cart?.items ?? []);
  }

  // Add `quantity` of a variant. Quantities accumulate; the running total may not
  // exceed available stock. A cart row is created lazily on the first add so
  // empty guest carts never hit the table.
  async addItem(
    owner: CartOwner,
    variantId: string,
    quantity: number,
  ): Promise<CartView> {
    const variant = await this.variants.getPurchasable(variantId); // 404 if not buyable
    const cart = await this.getOrCreateCart(owner);

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    const desired = (existing?.quantity ?? 0) + quantity;
    this.assertStock(desired, variant.stockQty);

    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, variantId, quantity: desired },
      update: { quantity: desired },
    });
    return this.viewForCart(cart.id);
  }

  // Set an item's quantity to an absolute value (must be in the cart already).
  async updateItem(
    owner: CartOwner,
    variantId: string,
    quantity: number,
  ): Promise<CartView> {
    const cart = await this.requireCart(owner);
    const item = await this.prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });
    if (!item) {
      throw new NotFoundException('Item is not in the cart.');
    }
    const variant = await this.variants.getPurchasable(variantId);
    this.assertStock(quantity, variant.stockQty);

    await this.prisma.cartItem.update({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      data: { quantity },
    });
    return this.viewForCart(cart.id);
  }

  // Idempotent: removing an absent item (or from an absent cart) is a no-op.
  async removeItem(owner: CartOwner, variantId: string): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({
      where: this.ownerWhere(owner),
    });
    if (!cart) {
      return { ...EMPTY_VIEW };
    }
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId } });
    return this.viewForCart(cart.id);
  }

  async clear(owner: CartOwner): Promise<CartView> {
    const cart = await this.prisma.cart.findUnique({
      where: this.ownerWhere(owner),
    });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return { ...EMPTY_VIEW };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async viewForCart(cartId: string): Promise<CartView> {
    const items = await this.prisma.cartItem.findMany({ where: { cartId } });
    return this.buildView(items);
  }

  // Enrich stored lines with live variant data. Items whose variant is no longer
  // purchasable (archived / product hidden) are dropped from the view so the
  // subtotal never counts something the customer can't buy; the stale rows are
  // re-validated at checkout.
  private async buildView(items: CartItem[]): Promise<CartView> {
    if (items.length === 0) {
      return { ...EMPTY_VIEW };
    }
    const variants = await this.variants.getPurchasableByIds(
      items.map((i) => i.variantId),
    );
    const byId = new Map(variants.map((v) => [v.id, v]));

    const views: CartItemView[] = [];
    for (const item of items) {
      const variant = byId.get(item.variantId);
      if (!variant) continue;
      views.push({
        variantId: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        quantity: item.quantity,
        unitPriceCents: variant.priceCents,
        lineCents: variant.priceCents * item.quantity,
        stockQty: variant.stockQty,
      });
    }
    const subtotalCents = views.reduce((sum, i) => sum + i.lineCents, 0);
    return { items: views, subtotalCents };
  }

  private async getOrCreateCart(owner: CartOwner): Promise<Cart> {
    const existing = await this.prisma.cart.findUnique({
      where: this.ownerWhere(owner),
    });
    return existing ?? this.prisma.cart.create({ data: this.ownerData(owner) });
  }

  private async requireCart(owner: CartOwner): Promise<Cart> {
    const cart = await this.prisma.cart.findUnique({
      where: this.ownerWhere(owner),
    });
    if (!cart) {
      throw new NotFoundException('Item is not in the cart.');
    }
    return cart;
  }

  private ownerWhere(owner: CartOwner): Prisma.CartWhereUniqueInput {
    return 'userId' in owner
      ? { userId: owner.userId }
      : { sessionId: owner.sessionId };
  }

  private ownerData(owner: CartOwner): Prisma.CartCreateInput {
    return 'userId' in owner
      ? { userId: owner.userId }
      : { sessionId: owner.sessionId };
  }

  private assertStock(quantity: number, stockQty: number): void {
    if (stockQty <= 0) {
      throw new BadRequestException('This variant is out of stock.');
    }
    if (quantity > stockQty) {
      throw new BadRequestException(`Only ${stockQty} left in stock.`);
    }
  }
}
