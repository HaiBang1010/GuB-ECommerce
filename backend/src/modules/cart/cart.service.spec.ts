import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartItem, ProductVariant } from '@prisma/client';
import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductVariantService } from '../product/variant/variant.service';

type CartDelegate = { findUnique: jest.Mock; create: jest.Mock };
type CartItemDelegate = {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
  deleteMany: jest.Mock;
};
type VariantsMock = {
  getPurchasable: jest.Mock;
  getPurchasableByIds: jest.Mock;
};

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'v1',
    productId: 'p1',
    sku: 'SNEAKER-42-RED',
    size: '42',
    color: 'Red',
    priceCents: 1000,
    stockQty: 5,
    archivedAt: null,
    ...overrides,
  };
}

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'ci1',
    cartId: 'c1',
    variantId: 'v1',
    quantity: 1,
    ...overrides,
  };
}

describe('CartService', () => {
  let prisma: { cart: CartDelegate; cartItem: CartItemDelegate };
  let variants: VariantsMock;
  let service: CartService;

  beforeEach(() => {
    prisma = {
      cart: { findUnique: jest.fn(), create: jest.fn() },
      cartItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    variants = {
      getPurchasable: jest.fn(),
      getPurchasableByIds: jest.fn(),
    };
    service = new CartService(
      prisma as unknown as PrismaService,
      variants as unknown as ProductVariantService,
    );
  });

  describe('getView', () => {
    it('returns an empty view when the owner has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      await expect(service.getView({ userId: 'u1' })).resolves.toEqual({
        items: [],
        subtotalCents: 0,
      });
    });

    it('enriches lines with live data and drops unpurchasable variants', async () => {
      prisma.cart.findUnique.mockResolvedValue({
        id: 'c1',
        items: [
          makeItem({ variantId: 'v1', quantity: 2 }),
          makeItem({ variantId: 'gone', quantity: 9 }),
        ],
      });
      variants.getPurchasableByIds.mockResolvedValue([
        makeVariant({ id: 'v1', priceCents: 1500, stockQty: 8 }),
      ]);

      const view = await service.getView({ userId: 'u1' });
      expect(view.items).toHaveLength(1);
      expect(view.items[0]).toMatchObject({
        variantId: 'v1',
        quantity: 2,
        unitPriceCents: 1500,
        lineCents: 3000,
      });
      expect(view.subtotalCents).toBe(3000);
    });
  });

  describe('addItem', () => {
    it('creates the cart lazily and adds a new line (guest session)', async () => {
      variants.getPurchasable.mockResolvedValue(
        makeVariant({ id: 'v1', stockQty: 5, priceCents: 1000 }),
      );
      prisma.cart.findUnique.mockResolvedValue(null); // no cart yet
      prisma.cart.create.mockResolvedValue({ id: 'c1' });
      prisma.cartItem.findUnique.mockResolvedValue(null); // no existing line
      prisma.cartItem.upsert.mockResolvedValue({});
      prisma.cartItem.findMany.mockResolvedValue([
        makeItem({ variantId: 'v1', quantity: 2 }),
      ]);
      variants.getPurchasableByIds.mockResolvedValue([
        makeVariant({ id: 'v1', stockQty: 5, priceCents: 1000 }),
      ]);

      const view = await service.addItem({ sessionId: 's1' }, 'v1', 2);
      expect(prisma.cart.create).toHaveBeenCalledWith({
        data: { sessionId: 's1' },
      });
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
        where: { cartId_variantId: { cartId: 'c1', variantId: 'v1' } },
        create: { cartId: 'c1', variantId: 'v1', quantity: 2 },
        update: { quantity: 2 },
      });
      expect(view.subtotalCents).toBe(2000);
    });

    it('accumulates onto an existing line', async () => {
      variants.getPurchasable.mockResolvedValue(makeVariant({ stockQty: 10 }));
      prisma.cart.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.cartItem.findUnique.mockResolvedValue(makeItem({ quantity: 3 }));
      prisma.cartItem.upsert.mockResolvedValue({});
      prisma.cartItem.findMany.mockResolvedValue([makeItem({ quantity: 5 })]);
      variants.getPurchasableByIds.mockResolvedValue([makeVariant()]);

      await service.addItem({ userId: 'u1' }, 'v1', 2);
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { quantity: 5 } }),
      );
    });

    it('rejects when the running total exceeds stock', async () => {
      variants.getPurchasable.mockResolvedValue(makeVariant({ stockQty: 3 }));
      prisma.cart.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.cartItem.findUnique.mockResolvedValue(makeItem({ quantity: 2 }));

      await expect(
        service.addItem({ userId: 'u1' }, 'v1', 2),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
    });

    it('rejects an out-of-stock variant', async () => {
      variants.getPurchasable.mockResolvedValue(makeVariant({ stockQty: 0 }));
      prisma.cart.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        service.addItem({ userId: 'u1' }, 'v1', 1),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('propagates NotFound for an unpurchasable variant without writing', async () => {
      variants.getPurchasable.mockRejectedValue(
        new NotFoundException('Variant not found.'),
      );
      await expect(
        service.addItem({ userId: 'u1' }, 'ghost', 1),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.cart.create).not.toHaveBeenCalled();
    });
  });

  describe('updateItem', () => {
    it('throws NotFound when the item is not in the cart', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.cartItem.findUnique.mockResolvedValue(null);
      await expect(
        service.updateItem({ userId: 'u1' }, 'v1', 2),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when the owner has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      await expect(
        service.updateItem({ userId: 'u1' }, 'v1', 2),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sets the absolute quantity within stock', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.cartItem.findUnique.mockResolvedValue(makeItem({ quantity: 1 }));
      variants.getPurchasable.mockResolvedValue(makeVariant({ stockQty: 9 }));
      prisma.cartItem.update.mockResolvedValue({});
      prisma.cartItem.findMany.mockResolvedValue([makeItem({ quantity: 4 })]);
      variants.getPurchasableByIds.mockResolvedValue([makeVariant()]);

      await service.updateItem({ userId: 'u1' }, 'v1', 4);
      expect(prisma.cartItem.update).toHaveBeenCalledWith({
        where: { cartId_variantId: { cartId: 'c1', variantId: 'v1' } },
        data: { quantity: 4 },
      });
    });
  });

  describe('removeItem', () => {
    it('is a no-op when the owner has no cart', async () => {
      prisma.cart.findUnique.mockResolvedValue(null);
      await expect(
        service.removeItem({ userId: 'u1' }, 'v1'),
      ).resolves.toEqual({ items: [], subtotalCents: 0 });
      expect(prisma.cartItem.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes the line and returns the refreshed view', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 1 });
      prisma.cartItem.findMany.mockResolvedValue([]);

      await service.removeItem({ userId: 'u1' }, 'v1');
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'c1', variantId: 'v1' },
      });
    });
  });

  describe('clear', () => {
    it('removes all lines for the cart', async () => {
      prisma.cart.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.cartItem.deleteMany.mockResolvedValue({ count: 2 });
      await expect(service.clear({ userId: 'u1' })).resolves.toEqual({
        items: [],
        subtotalCents: 0,
      });
      expect(prisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { cartId: 'c1' },
      });
    });
  });
});
