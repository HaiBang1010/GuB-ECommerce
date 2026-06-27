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
  // Pre-sale unit price when the line is discounted (so the UI can strike it
  // through), else null. Display-only — never used for the order total.
  compareAtCents: number | null;
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

  /**
   * Merge a guest's session cart into the user's cart on login (ARCHITECTURE
   * §5.2). Quantities are summed per variant and capped at live stock; a guest
   * line whose variant is no longer purchasable is dropped. The guest cart is
   * deleted afterwards. The upserts + guest-cart deletion run in one transaction
   * so a login never ends up with the items duplicated across both carts.
   */
  async mergeGuestIntoUser(
    userId: string,
    sessionId: string,
  ): Promise<CartView> {
    const guestCart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });
    if (!guestCart) {
      return this.getView({ userId });
    }
    if (guestCart.items.length === 0) {
      await this.prisma.cart.delete({ where: { id: guestCart.id } });
      return this.getView({ userId });
    }

    const userCart = await this.getOrCreateCart({ userId });
    const userItems = await this.prisma.cartItem.findMany({
      where: { cartId: userCart.id },
    });
    const userQty = new Map(userItems.map((i) => [i.variantId, i.quantity]));

    const variantIds = [...new Set(guestCart.items.map((i) => i.variantId))];
    const purchasable = await this.variants.getPurchasableByIds(variantIds);
    const stockById = new Map(purchasable.map((v) => [v.id, v.stockQty]));

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const item of guestCart.items) {
      const stock = stockById.get(item.variantId);
      if (stock === undefined || stock <= 0) continue; // dropped: not buyable
      const combined = (userQty.get(item.variantId) ?? 0) + item.quantity;
      const finalQty = Math.min(combined, stock);
      ops.push(
        this.prisma.cartItem.upsert({
          where: {
            cartId_variantId: { cartId: userCart.id, variantId: item.variantId },
          },
          create: {
            cartId: userCart.id,
            variantId: item.variantId,
            quantity: finalQty,
          },
          update: { quantity: finalQty },
        }),
      );
    }
    // Remove the guest cart (items first — CartItem.cart has no cascade).
    ops.push(
      this.prisma.cartItem.deleteMany({ where: { cartId: guestCart.id } }),
    );
    ops.push(this.prisma.cart.delete({ where: { id: guestCart.id } }));

    await this.prisma.$transaction(ops);
    return this.viewForCart(userCart.id);
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
      // The sale-aware price the customer is charged (ProductVariantService folds
      // the product sale into effectivePriceCents). The order snapshot reads this.
      const unitPriceCents = variant.effectivePriceCents;
      views.push({
        variantId: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        quantity: item.quantity,
        unitPriceCents,
        compareAtCents:
          unitPriceCents < variant.priceCents ? variant.priceCents : null,
        lineCents: unitPriceCents * item.quantity,
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
