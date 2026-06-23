import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Address, Order, OrderItem, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AddressService } from '../iam/address/address.service';
import { ProductService } from '../product/product/product.service';
import {
  ProductVariantService,
  StockChange,
} from '../product/variant/variant.service';

// Default window after which an unpaid order is auto-cancelled and its stock
// released (the release-expired job; ARCHITECTURE §5.6 / §6).
const PENDING_TTL_MINUTES = 15;

export type OrderWithDetail = Prisma.OrderGetPayload<{
  include: { items: true; statusHistory: true };
}>;

type OrderWithItems = Order & { items: OrderItem[] };

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    // Cross-module collaborators, all called in-process (never their tables).
    private readonly cart: CartService,
    private readonly addresses: AddressService,
    private readonly products: ProductService,
    private readonly variants: ProductVariantService,
  ) {}

  /**
   * Place an order from the user's cart. Prices, product names, size/color are
   * SNAPSHOT at this moment (ARCHITECTURE §4.4); the shipping address is copied
   * as JSON, not referenced. Stock is decremented atomically inside one
   * transaction, so the order and the stock movement commit (or roll back)
   * together — no oversell, no orphaned decrement.
   */
  async createFromCart(
    userId: string,
    addressId: string,
  ): Promise<OrderWithDetail> {
    const view = await this.cart.getView({ userId });
    if (view.items.length === 0) {
      throw new BadRequestException('Cart is empty.');
    }
    const address = await this.addresses.getOwnedActive(userId, addressId);

    // Resolve product names for the snapshot through the product module.
    const productIds = [...new Set(view.items.map((i) => i.productId))];
    const products = await this.products.getActiveByIds(productIds);
    const productById = new Map(products.map((p) => [p.id, p]));

    const itemsData: Prisma.OrderItemCreateManyOrderInput[] = [];
    let subtotalCents = 0;
    for (const item of view.items) {
      const product = productById.get(item.productId);
      if (!product) {
        throw new BadRequestException('Some items are no longer available.');
      }
      subtotalCents += item.lineCents;
      itemsData.push({
        variantId: item.variantId,
        productId: item.productId,
        productNameVi: product.nameVi,
        productNameEn: product.nameEn,
        size: item.size,
        color: item.color,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      });
    }
    const discountCents = 0; // vouchers arrive in Phase 4
    const totalCents = subtotalCents - discountCents;
    const stockChanges: StockChange[] = view.items.map((i) => ({
      variantId: i.variantId,
      quantity: i.quantity,
    }));

    const order = await this.prisma.$transaction(async (tx) => {
      // The stock-race fix: atomic decrement; throwing here rolls back the order.
      await this.variants.decrementForOrder(tx, stockChanges);
      return tx.order.create({
        data: {
          userId,
          status: OrderStatus.PENDING_PAYMENT,
          subtotalCents,
          discountCents,
          totalCents,
          shippingAddress: this.snapshotAddress(address),
          placedAt: new Date(),
          items: { createMany: { data: itemsData } },
          statusHistory: { create: { status: OrderStatus.PENDING_PAYMENT } },
        },
        include: { items: true, statusHistory: true },
      });
    });

    // Cart cleared AFTER commit: a failed clear is cosmetic (a stale cart), never
    // a stock/money inconsistency, so it stays out of the critical transaction.
    await this.cart.clear({ userId });
    return order;
  }

  async listForUser(userId: string): Promise<OrderWithDetail[]> {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true, statusHistory: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForUser(userId: string, orderId: string): Promise<OrderWithDetail> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, statusHistory: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found.');
    }
    return order;
  }

  // User cancels their own unpaid order; stock is released.
  async cancel(userId: string, orderId: string): Promise<OrderWithDetail> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Order not found.');
    }
    if (order.status === OrderStatus.CANCELLED) {
      return this.getForUser(userId, orderId); // idempotent
    }
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Only an unpaid order can be cancelled.');
    }
    return this.cancelAndRelease(order);
  }

  /**
   * Auto-cancel unpaid orders older than the TTL and release their stock. Called
   * by the secured release-expired job (UptimeRobot → POST /admin/jobs/...).
   * Idempotent and concurrency-safe: cancelAndRelease only releases stock for an
   * order it actually transitions out of PENDING_PAYMENT.
   */
  async releaseExpired(
    olderThanMinutes: number = PENDING_TTL_MINUTES,
  ): Promise<{ released: number }> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const expired = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
      },
      include: { items: true },
    });
    for (const order of expired) {
      await this.cancelAndRelease(order);
    }
    return { released: expired.length };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  // Flip PENDING_PAYMENT -> CANCELLED and release stock in one transaction. The
  // conditional updateMany is the concurrency guard: only the caller that wins
  // the status flip releases stock, so two overlapping cancels (user + cron)
  // never double-restock.
  private async cancelAndRelease(
    order: OrderWithItems,
  ): Promise<OrderWithDetail> {
    return this.prisma.$transaction(async (tx) => {
      const flip = await tx.order.updateMany({
        where: { id: order.id, status: OrderStatus.PENDING_PAYMENT },
        data: { status: OrderStatus.CANCELLED },
      });
      if (flip.count === 1) {
        await this.variants.releaseForOrder(
          tx,
          order.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
          })),
        );
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.CANCELLED,
            note: 'Stock released.',
          },
        });
      }
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, statusHistory: true },
      });
    });
  }

  // Immutable copy of the shipping address (not a foreign key) so the order
  // stays correct even if the user later edits or deletes the address.
  private snapshotAddress(address: Address): Prisma.InputJsonObject {
    return {
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      ward: address.ward,
      district: address.district,
      city: address.city,
      country: address.country,
      postalCode: address.postalCode,
    };
  }
}
