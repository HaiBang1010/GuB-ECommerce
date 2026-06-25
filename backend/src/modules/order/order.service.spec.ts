import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Address, Prisma } from '@prisma/client';
import { OrderService } from './order.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AddressService } from '../iam/address/address.service';
import { ProductService } from '../product/product/product.service';
import { ProductVariantService } from '../product/variant/variant.service';

function makeAddress(): Address {
  return {
    id: 'addr1',
    userId: 'u1',
    fullName: 'Jane Doe',
    phone: '0900000000',
    line1: '1 Main St',
    line2: null,
    ward: null,
    district: null,
    city: 'HCMC',
    country: 'VN',
    postalCode: null,
    isDefault: true,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function viewItem(overrides: Record<string, unknown> = {}) {
  return {
    variantId: 'v1',
    productId: 'p1',
    sku: 'SKU-1',
    size: '42',
    color: 'Red',
    quantity: 2,
    unitPriceCents: 1000,
    lineCents: 2000,
    stockQty: 5,
    ...overrides,
  };
}

describe('OrderService', () => {
  let prisma: {
    order: { findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let cart: { getView: jest.Mock; clear: jest.Mock };
  let addresses: { getOwnedActive: jest.Mock };
  let products: { getActiveByIds: jest.Mock };
  let variants: { decrementForOrder: jest.Mock; releaseForOrder: jest.Mock };
  let service: OrderService;

  beforeEach(() => {
    prisma = {
      order: { findUnique: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    cart = { getView: jest.fn(), clear: jest.fn() };
    addresses = { getOwnedActive: jest.fn() };
    products = { getActiveByIds: jest.fn() };
    variants = { decrementForOrder: jest.fn(), releaseForOrder: jest.fn() };
    service = new OrderService(
      prisma as unknown as PrismaService,
      cart as unknown as CartService,
      addresses as unknown as AddressService,
      products as unknown as ProductService,
      variants as unknown as ProductVariantService,
    );
  });

  describe('createFromCart', () => {
    it('rejects an empty cart', async () => {
      cart.getView.mockResolvedValue({ items: [], subtotalCents: 0 });
      await expect(service.createFromCart('u1', 'addr1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('snapshots items, decrements stock atomically, and clears the cart', async () => {
      cart.getView.mockResolvedValue({
        items: [viewItem()],
        subtotalCents: 2000,
      });
      addresses.getOwnedActive.mockResolvedValue(makeAddress());
      products.getActiveByIds.mockResolvedValue([
        { id: 'p1', nameVi: 'Áo', nameEn: 'Shirt' },
      ]);
      variants.decrementForOrder.mockResolvedValue(undefined);
      const created = { id: 'o1', items: [], statusHistory: [] };
      const txMock = { order: { create: jest.fn().mockResolvedValue(created) } };
      prisma.$transaction.mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );
      cart.clear.mockResolvedValue({ items: [], subtotalCents: 0 });

      const result = await service.createFromCart('u1', 'addr1');

      expect(variants.decrementForOrder).toHaveBeenCalledWith(txMock, [
        { variantId: 'v1', quantity: 2 },
      ]);
      expect(txMock.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            status: 'PENDING_PAYMENT',
            subtotalCents: 2000,
            totalCents: 2000,
            items: {
              createMany: {
                data: [
                  expect.objectContaining({
                    variantId: 'v1',
                    productId: 'p1',
                    productNameVi: 'Áo',
                    productNameEn: 'Shirt',
                    unitPriceCents: 1000,
                    quantity: 2,
                  }),
                ],
              },
            },
          }),
        }),
      );
      expect(cart.clear).toHaveBeenCalledWith({ userId: 'u1' });
      expect(result).toBe(created);
    });

    it('does not clear the cart when the stock decrement fails', async () => {
      cart.getView.mockResolvedValue({
        items: [viewItem()],
        subtotalCents: 2000,
      });
      addresses.getOwnedActive.mockResolvedValue(makeAddress());
      products.getActiveByIds.mockResolvedValue([
        { id: 'p1', nameVi: 'Áo', nameEn: 'Shirt' },
      ]);
      variants.decrementForOrder.mockRejectedValue(
        new ConflictException('Insufficient stock for one or more items.'),
      );
      prisma.$transaction.mockImplementation(
        (cb: (tx: unknown) => unknown) => cb({ order: { create: jest.fn() } }),
      );

      await expect(service.createFromCart('u1', 'addr1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(cart.clear).not.toHaveBeenCalled();
    });

    it('propagates NotFound when the address is not owned', async () => {
      cart.getView.mockResolvedValue({
        items: [viewItem()],
        subtotalCents: 2000,
      });
      addresses.getOwnedActive.mockRejectedValue(
        new NotFoundException('Address not found.'),
      );
      await expect(service.createFromCart('u1', 'addr1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('cancel', () => {
    it('throws NotFound for an order owned by someone else', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'other',
        status: 'PENDING_PAYMENT',
        items: [],
      });
      await expect(service.cancel('u1', 'o1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects cancelling a non-pending order with 409', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: 'PAID',
        items: [],
      });
      await expect(service.cancel('u1', 'o1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('flips a pending order to CANCELLED and releases its stock', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: 'PENDING_PAYMENT',
        items: [{ variantId: 'v1', quantity: 2 }],
      });
      const txMock = {
        order: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 'o1', status: 'CANCELLED', items: [], statusHistory: [] }),
        },
        orderStatusHistory: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );
      variants.releaseForOrder.mockResolvedValue(undefined);

      const result = await service.cancel('u1', 'o1');
      expect(txMock.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'o1', status: 'PENDING_PAYMENT' },
        data: { status: 'CANCELLED' },
      });
      expect(variants.releaseForOrder).toHaveBeenCalledWith(txMock, [
        { variantId: 'v1', quantity: 2 },
      ]);
      expect(txMock.orderStatusHistory.create).toHaveBeenCalledWith({
        data: { orderId: 'o1', status: 'CANCELLED', note: 'Cancelled by user.' },
      });
      expect(result.status).toBe('CANCELLED');
    });

    it('does NOT release stock when it loses the cancel race (count 0)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        status: 'PENDING_PAYMENT',
        items: [{ variantId: 'v1', quantity: 2 }],
      });
      const txMock = {
        order: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 'o1', status: 'CANCELLED', items: [], statusHistory: [] }),
        },
        orderStatusHistory: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );

      await service.cancel('u1', 'o1');
      expect(variants.releaseForOrder).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('advances PAID -> PROCESSING and records the timeline entry', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PAID' });
      const txMock = {
        order: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: 'o1', status: 'PROCESSING', items: [], statusHistory: [] }),
        },
        orderStatusHistory: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );

      const result = await service.updateStatus('o1', 'PROCESSING' as never, 'packed');
      expect(txMock.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'o1', status: 'PAID' },
        data: { status: 'PROCESSING' },
      });
      expect(txMock.orderStatusHistory.create).toHaveBeenCalledWith({
        data: { orderId: 'o1', status: 'PROCESSING', note: 'packed' },
      });
      expect(result.status).toBe('PROCESSING');
    });

    it('rejects an illegal transition (PAID -> SHIPPED)', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PAID' });
      await expect(
        service.updateStatus('o1', 'SHIPPED' as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('missing', 'PROCESSING' as never),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Conflict when the status changed concurrently (count 0)', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: 'o1', status: 'PAID' });
      const txMock = {
        order: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUniqueOrThrow: jest.fn(),
        },
        orderStatusHistory: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );
      await expect(
        service.updateStatus('o1', 'PROCESSING' as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(txMock.orderStatusHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('listForAdmin', () => {
    it('filters by status when provided', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await service.listForAdmin('SHIPPED' as never);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'SHIPPED' } }),
      );
    });

    it('lists all orders when no status filter is given', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await service.listForAdmin();
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      );
    });
  });

  describe('markPaid', () => {
    it('flips PENDING_PAYMENT to PAID and records history', async () => {
      const tx = {
        order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        orderStatusHistory: { create: jest.fn() },
      };
      await service.markPaid(tx as unknown as Prisma.TransactionClient, 'o1');
      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'o1', status: 'PENDING_PAYMENT' },
        data: { status: 'PAID' },
      });
      expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
        data: { orderId: 'o1', status: 'PAID' },
      });
    });

    it('is a no-op when the order is not pending (count 0)', async () => {
      const tx = {
        order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        orderStatusHistory: { create: jest.fn() },
      };
      await service.markPaid(tx as unknown as Prisma.TransactionClient, 'o1');
      expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('releaseExpired', () => {
    it('cancels every expired order and reports the count', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'o1', userId: 'u1', status: 'PENDING_PAYMENT', items: [{ variantId: 'v1', quantity: 1 }] },
        { id: 'o2', userId: 'u2', status: 'PENDING_PAYMENT', items: [{ variantId: 'v2', quantity: 1 }] },
      ]);
      const txMock = {
        order: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ items: [], statusHistory: [] }),
        },
        orderStatusHistory: { create: jest.fn() },
      };
      prisma.$transaction.mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );
      variants.releaseForOrder.mockResolvedValue(undefined);

      await expect(service.releaseExpired(15)).resolves.toEqual({ released: 2 });
      expect(variants.releaseForOrder).toHaveBeenCalledTimes(2);
    });
  });
});
