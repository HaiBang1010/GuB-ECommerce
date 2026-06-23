import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartItem, ProductVariant } from '@prisma/client';
import { CartService } from './cart.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductVariantService } from '../product/variant/variant.service';

type CartDelegate = {
  findUnique: jest.Mock;
  create: jest.Mock;
  delete: jest.Mock;
};
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
  let prisma: {
    cart: CartDelegate;
    cartItem: CartItemDelegate;
    $transaction: jest.Mock;
  };
  let variants: VariantsMock;
  let service: CartService;

  beforeEach(() => {
    prisma = {
      cart: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      cartItem: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
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

  describe('mergeGuestIntoUser', () => {
    it('returns the user view and does nothing when there is no guest cart', async () => {
      prisma.cart.findUnique
        .mockResolvedValueOnce(null) // guest lookup
        .mockResolvedValueOnce(null); // getView user lookup
      await expect(service.mergeGuestIntoUser('u1', 's1')).resolves.toEqual({
        items: [],
        subtotalCents: 0,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.cart.delete).not.toHaveBeenCalled();
    });

    it('deletes an empty guest cart and returns the user view', async () => {
      prisma.cart.findUnique
        .mockResolvedValueOnce({ id: 'g1', items: [] }) // guest (empty)
        .mockResolvedValueOnce(null); // getView user
      prisma.cart.delete.mockResolvedValue({});
      await expect(service.mergeGuestIntoUser('u1', 's1')).resolves.toEqual({
        items: [],
        subtotalCents: 0,
      });
      expect(prisma.cart.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('sums quantities and removes the guest cart atomically', async () => {
      prisma.cart.findUnique
        .mockResolvedValueOnce({
          id: 'g1',
          items: [makeItem({ variantId: 'v1', quantity: 2 })],
        }) // guest
        .mockResolvedValueOnce(null); // getOrCreateCart(user): none yet
      prisma.cart.create.mockResolvedValue({ id: 'u-cart' });
      prisma.cartItem.findMany
        .mockResolvedValueOnce([]) // user existing items
        .mockResolvedValueOnce([makeItem({ cartId: 'u-cart', variantId: 'v1', quantity: 2 })]); // viewForCart
      variants.getPurchasableByIds
        .mockResolvedValueOnce([makeVariant({ id: 'v1', stockQty: 10 })]) // stock map
        .mockResolvedValueOnce([makeVariant({ id: 'v1', stockQty: 10, priceCents: 1000 })]); // view
      prisma.cartItem.upsert.mockReturnValue('upsertOp');
      prisma.cartItem.deleteMany.mockReturnValue('delItemsOp');
      prisma.cart.delete.mockReturnValue('delCartOp');
      prisma.$transaction.mockResolvedValue([]);

      const view = await service.mergeGuestIntoUser('u1', 's1');
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
        where: { cartId_variantId: { cartId: 'u-cart', variantId: 'v1' } },
        create: { cartId: 'u-cart', variantId: 'v1', quantity: 2 },
        update: { quantity: 2 },
      });
      expect(prisma.$transaction).toHaveBeenCalledWith([
        'upsertOp',
        'delItemsOp',
        'delCartOp',
      ]);
      expect(view.subtotalCents).toBe(2000);
    });

    it('caps the merged quantity at available stock', async () => {
      prisma.cart.findUnique
        .mockResolvedValueOnce({
          id: 'g1',
          items: [makeItem({ variantId: 'v1', quantity: 5 })],
        })
        .mockResolvedValueOnce({ id: 'u-cart' });
      prisma.cartItem.findMany
        .mockResolvedValueOnce([
          makeItem({ cartId: 'u-cart', variantId: 'v1', quantity: 8 }),
        ]) // user already has 8
        .mockResolvedValueOnce([
          makeItem({ cartId: 'u-cart', variantId: 'v1', quantity: 10 }),
        ]);
      variants.getPurchasableByIds
        .mockResolvedValueOnce([makeVariant({ id: 'v1', stockQty: 10 })])
        .mockResolvedValueOnce([makeVariant({ id: 'v1', stockQty: 10 })]);
      prisma.cartItem.upsert.mockReturnValue('upsertOp');
      prisma.cartItem.deleteMany.mockReturnValue('delItemsOp');
      prisma.cart.delete.mockReturnValue('delCartOp');
      prisma.$transaction.mockResolvedValue([]);

      await service.mergeGuestIntoUser('u1', 's1');
      // 8 + 5 = 13, capped to stock 10.
      expect(prisma.cartItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { quantity: 10 } }),
      );
    });

    it('drops guest lines whose variant is no longer purchasable', async () => {
      prisma.cart.findUnique
        .mockResolvedValueOnce({
          id: 'g1',
          items: [makeItem({ variantId: 'gone', quantity: 2 })],
        })
        .mockResolvedValueOnce({ id: 'u-cart' });
      prisma.cartItem.findMany
        .mockResolvedValueOnce([]) // user items
        .mockResolvedValueOnce([]); // view
      variants.getPurchasableByIds
        .mockResolvedValueOnce([]) // nothing purchasable
        .mockResolvedValueOnce([]);
      prisma.cartItem.deleteMany.mockReturnValue('delItemsOp');
      prisma.cart.delete.mockReturnValue('delCartOp');
      prisma.$transaction.mockResolvedValue([]);

      await service.mergeGuestIntoUser('u1', 's1');
      expect(prisma.cartItem.upsert).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledWith([
        'delItemsOp',
        'delCartOp',
      ]);
    });
  });
});
