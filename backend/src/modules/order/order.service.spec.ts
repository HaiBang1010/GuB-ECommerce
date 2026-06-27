import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Address, Prisma } from '@prisma/client';
import { OrderService } from './order.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AddressService } from '../iam/address/address.service';
import { ProductService } from '../product/product/product.service';
import { ProductVariantService } from '../product/variant/variant.service';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../iam/user/user.service';
import { VoucherService } from '../voucher/voucher.service';

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
    order: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      groupBy: jest.Mock;
    };
    orderItem: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let cart: { getView: jest.Mock; clear: jest.Mock };
  let addresses: { getOwnedActive: jest.Mock };
  let products: { getActiveByIds: jest.Mock };
  let variants: { decrementForOrder: jest.Mock; releaseForOrder: jest.Mock };
  let notifications: { publishOrderStatus: jest.Mock };
  let users: {
    findById: jest.Mock;
    findManyByIds: jest.Mock;
    searchIdsByNameOrEmail: jest.Mock;
  };
  let vouchers: { validate: jest.Mock; redeem: jest.Mock };
  let service: OrderService;

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      orderItem: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    cart = { getView: jest.fn(), clear: jest.fn() };
    addresses = { getOwnedActive: jest.fn() };
    products = { getActiveByIds: jest.fn() };
    variants = { decrementForOrder: jest.fn(), releaseForOrder: jest.fn() };
    notifications = { publishOrderStatus: jest.fn() };
    users = {
      // Default: no enrichment / no search hits — overridden per test.
      findById: jest.fn().mockResolvedValue(null),
      findManyByIds: jest.fn().mockResolvedValue([]),
      searchIdsByNameOrEmail: jest.fn().mockResolvedValue([]),
    };
    vouchers = { validate: jest.fn(), redeem: jest.fn() };
    service = new OrderService(
      prisma as unknown as PrismaService,
      cart as unknown as CartService,
      addresses as unknown as AddressService,
      products as unknown as ProductService,
      variants as unknown as ProductVariantService,
      notifications as unknown as NotificationService,
      users as unknown as UserService,
      vouchers as unknown as VoucherService,
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

    it('applies a voucher: snapshots discount + code and redeems inside the tx', async () => {
      cart.getView.mockResolvedValue({
        items: [viewItem()],
        subtotalCents: 2000,
      });
      addresses.getOwnedActive.mockResolvedValue(makeAddress());
      products.getActiveByIds.mockResolvedValue([
        { id: 'p1', nameVi: 'Áo', nameEn: 'Shirt' },
      ]);
      variants.decrementForOrder.mockResolvedValue(undefined);
      const voucher = { id: 'vch1', code: 'SAVE10' };
      vouchers.validate.mockResolvedValue({
        voucher,
        voucherId: 'vch1',
        voucherCode: 'SAVE10',
        discountCents: 500,
      });
      vouchers.redeem.mockResolvedValue(undefined);
      const created = { id: 'o1', items: [], statusHistory: [] };
      const txMock = { order: { create: jest.fn().mockResolvedValue(created) } };
      prisma.$transaction.mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );
      cart.clear.mockResolvedValue({ items: [], subtotalCents: 0 });

      await service.createFromCart('u1', 'addr1', 'save10');

      // Validated against the LIVE subtotal (FE preview is non-binding).
      expect(vouchers.validate).toHaveBeenCalledWith('save10', 'u1', 2000);
      // Redeemed with the SAME tx client as the stock decrement (one transaction).
      expect(vouchers.redeem).toHaveBeenCalledWith(txMock, voucher, 'u1');
      expect(txMock.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotalCents: 2000,
            discountCents: 500,
            totalCents: 1500,
            voucherId: 'vch1',
            voucherCode: 'SAVE10',
          }),
        }),
      );
    });

    it('rolls the order back when the voucher redeem fails (cart not cleared)', async () => {
      cart.getView.mockResolvedValue({
        items: [viewItem()],
        subtotalCents: 2000,
      });
      addresses.getOwnedActive.mockResolvedValue(makeAddress());
      products.getActiveByIds.mockResolvedValue([
        { id: 'p1', nameVi: 'Áo', nameEn: 'Shirt' },
      ]);
      variants.decrementForOrder.mockResolvedValue(undefined);
      vouchers.validate.mockResolvedValue({
        voucher: { id: 'vch1', code: 'SAVE10' },
        voucherId: 'vch1',
        voucherCode: 'SAVE10',
        discountCents: 500,
      });
      // Lost the usage-limit race inside the tx → the whole order rolls back.
      vouchers.redeem.mockRejectedValue(
        new ConflictException('This voucher has reached its usage limit.'),
      );
      const txMock = { order: { create: jest.fn() } };
      prisma.$transaction.mockImplementation(
        (cb: (tx: unknown) => unknown) => cb(txMock),
      );

      await expect(
        service.createFromCart('u1', 'addr1', 'SAVE10'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(txMock.order.create).not.toHaveBeenCalled();
      expect(cart.clear).not.toHaveBeenCalled();
    });

    it('does not place the order when the voucher is invalid', async () => {
      cart.getView.mockResolvedValue({
        items: [viewItem()],
        subtotalCents: 2000,
      });
      addresses.getOwnedActive.mockResolvedValue(makeAddress());
      products.getActiveByIds.mockResolvedValue([
        { id: 'p1', nameVi: 'Áo', nameEn: 'Shirt' },
      ]);
      vouchers.validate.mockRejectedValue(
        new BadRequestException('This voucher has expired.'),
      );

      await expect(
        service.createFromCart('u1', 'addr1', 'EXPIRED'),
      ).rejects.toBeInstanceOf(BadRequestException);
      // Validation happens BEFORE the transaction — no stock movement, no order.
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(variants.decrementForOrder).not.toHaveBeenCalled();
    });

    it('places an order without a voucher (discountCents stays 0)', async () => {
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

      await service.createFromCart('u1', 'addr1');

      expect(vouchers.validate).not.toHaveBeenCalled();
      expect(vouchers.redeem).not.toHaveBeenCalled();
      expect(txMock.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountCents: 0,
            totalCents: 2000,
            voucherId: null,
            voucherCode: null,
          }),
        }),
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

  describe('getDeliveredOrderItemForUser', () => {
    it('returns {id, productId} for an owned, delivered order item', async () => {
      prisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi1',
        productId: 'p1',
        order: { userId: 'u1', status: 'DELIVERED' },
      });
      await expect(
        service.getDeliveredOrderItemForUser('u1', 'oi1'),
      ).resolves.toEqual({ id: 'oi1', productId: 'p1' });
    });

    it('throws NotFound for a missing order item', async () => {
      prisma.orderItem.findUnique.mockResolvedValue(null);
      await expect(
        service.getDeliveredOrderItemForUser('u1', 'missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when the order item belongs to someone else', async () => {
      prisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi1',
        productId: 'p1',
        order: { userId: 'other', status: 'DELIVERED' },
      });
      await expect(
        service.getDeliveredOrderItemForUser('u1', 'oi1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Conflict when the order is not delivered yet', async () => {
      prisma.orderItem.findUnique.mockResolvedValue({
        id: 'oi1',
        productId: 'p1',
        order: { userId: 'u1', status: 'PAID' },
      });
      await expect(
        service.getDeliveredOrderItemForUser('u1', 'oi1'),
      ).rejects.toBeInstanceOf(ConflictException);
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
      // Publishes the status event post-commit (notify filtering lives in the
      // notification service).
      expect(notifications.publishOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'o1', status: 'PROCESSING' }),
      );
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
    it('lists all orders (empty where) when no filters are given', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await service.listForAdmin({});
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filters by multiple statuses (status in [...])', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await service.listForAdmin({ statuses: ['PAID', 'SHIPPED'] as never });
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: { in: ['PAID', 'SHIPPED'] } } }),
      );
    });

    it('searches by order id OR matching customer userIds (no cross-schema JOIN)', async () => {
      users.searchIdsByNameOrEmail.mockResolvedValue(['u9']);
      prisma.order.findMany.mockResolvedValue([]);

      await service.listForAdmin({ search: ' jane ' });

      expect(users.searchIdsByNameOrEmail).toHaveBeenCalledWith('jane');
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { id: { contains: 'jane', mode: 'insensitive' } },
              { userId: { in: ['u9'] } },
            ],
          },
        }),
      );
    });

    it('search with no matching users still filters by order id alone', async () => {
      users.searchIdsByNameOrEmail.mockResolvedValue([]);
      prisma.order.findMany.mockResolvedValue([]);

      await service.listForAdmin({ search: 'abc' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ id: { contains: 'abc', mode: 'insensitive' } }] },
        }),
      );
    });

    it('combines status + search (AND) in one where', async () => {
      users.searchIdsByNameOrEmail.mockResolvedValue([]);
      prisma.order.findMany.mockResolvedValue([]);

      await service.listForAdmin({ statuses: ['PAID'] as never, search: 'x' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: ['PAID'] },
            OR: [{ id: { contains: 'x', mode: 'insensitive' } }],
          },
        }),
      );
    });

    it('enriches each row with customer {email,name}; null when the user is gone', async () => {
      prisma.order.findMany.mockResolvedValue([
        { id: 'o1', userId: 'u1', items: [], statusHistory: [] },
        { id: 'o2', userId: 'ghost', items: [], statusHistory: [] },
      ]);
      users.findManyByIds.mockResolvedValue([
        { id: 'u1', email: 'jane@example.com', name: 'Jane' },
      ]);

      const result = await service.listForAdmin({});

      expect(users.findManyByIds).toHaveBeenCalledWith(['u1', 'ghost']);
      expect(result.items[0].customer).toEqual({
        email: 'jane@example.com',
        name: 'Jane',
      });
      expect(result.items[1].customer).toBeNull();
    });

    it('defaults to page 1, pageSize 10 (skip 0, take 10) and returns total from count', async () => {
      prisma.order.count.mockResolvedValue(42);
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.listForAdmin({});

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
      expect(result).toEqual(
        expect.objectContaining({ total: 42, page: 1, pageSize: 10 }),
      );
    });

    it('applies page/pageSize as skip/take', async () => {
      prisma.order.count.mockResolvedValue(100);
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.listForAdmin({ page: 3, pageSize: 20 });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(20);
    });

    it('counts over the SAME filter+search where as the page query', async () => {
      users.searchIdsByNameOrEmail.mockResolvedValue(['u9']);
      prisma.order.count.mockResolvedValue(3);
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.listForAdmin({
        statuses: ['PAID'] as never,
        search: 'x',
      });

      const expectedWhere = {
        status: { in: ['PAID'] },
        OR: [
          { id: { contains: 'x', mode: 'insensitive' } },
          { userId: { in: ['u9'] } },
        ],
      };
      expect(prisma.order.count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere }),
      );
      expect(result.total).toBe(3);
    });

    it('a page past the end has empty items but the real total', async () => {
      prisma.order.count.mockResolvedValue(5);
      prisma.order.findMany.mockResolvedValue([]);

      const result = await service.listForAdmin({ page: 99, pageSize: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(5);
    });
  });

  describe('getForAdmin', () => {
    it('attaches the resolved customer {email,name} to the order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'u1',
        items: [],
        statusHistory: [],
      });
      users.findById.mockResolvedValue({
        id: 'u1',
        email: 'jane@example.com',
        name: 'Jane',
      });

      const result = await service.getForAdmin('o1');

      expect(users.findById).toHaveBeenCalledWith('u1');
      expect(result.customer).toEqual({
        email: 'jane@example.com',
        name: 'Jane',
      });
    });

    it('sets customer to null when the user is gone', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'o1',
        userId: 'ghost',
        items: [],
        statusHistory: [],
      });
      users.findById.mockResolvedValue(null);

      const result = await service.getForAdmin('o1');
      expect(result.customer).toBeNull();
    });

    it('throws NotFound for a missing order', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.getForAdmin('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getStatsForUser', () => {
    it('sums totals only over paid statuses and zero-fills every status', async () => {
      prisma.order.groupBy.mockResolvedValue([
        { status: 'PENDING_PAYMENT', _count: { _all: 1 }, _sum: { totalCents: 500 } },
        { status: 'PAID', _count: { _all: 2 }, _sum: { totalCents: 3000 } },
        { status: 'DELIVERED', _count: { _all: 1 }, _sum: { totalCents: 1500 } },
        { status: 'CANCELLED', _count: { _all: 1 }, _sum: { totalCents: 999 } },
      ]);

      const stats = await service.getStatsForUser('u1');

      expect(prisma.order.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['status'],
          where: { userId: 'u1' },
          _count: { _all: true },
          _sum: { totalCents: true },
        }),
      );
      expect(stats.totalOrders).toBe(5);
      // Only PAID (3000) + DELIVERED (1500) count toward spend.
      expect(stats.totalSpentCents).toBe(4500);
      expect(stats.byStatus.PAID).toBe(2);
      expect(stats.byStatus.PENDING_PAYMENT).toBe(1);
      expect(stats.byStatus.CANCELLED).toBe(1);
      // A status with no orders is present as 0.
      expect(stats.byStatus.REFUNDED).toBe(0);
      expect(stats.byStatus.SHIPPED).toBe(0);
    });

    it('returns all-zero stats when the user has no orders', async () => {
      prisma.order.groupBy.mockResolvedValue([]);
      const stats = await service.getStatsForUser('u1');
      expect(stats.totalOrders).toBe(0);
      expect(stats.totalSpentCents).toBe(0);
      expect(stats.byStatus.PAID).toBe(0);
    });
  });

  describe('listRecentForUser', () => {
    it('fetches the latest N orders (take/orderBy/include)', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      await service.listRecentForUser('u1', 5);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        include: { items: true, statusHistory: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    });
  });

  describe('markPaid', () => {
    it('flips PENDING_PAYMENT to PAID and records history', async () => {
      const tx = {
        order: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        orderStatusHistory: { create: jest.fn() },
      };
      await expect(
        service.markPaid(tx as unknown as Prisma.TransactionClient, 'o1'),
      ).resolves.toBe(true);
      expect(tx.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'o1', status: 'PENDING_PAYMENT' },
        data: { status: 'PAID' },
      });
      expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
        data: { orderId: 'o1', status: 'PAID' },
      });
    });

    it('is a no-op (returns false) when the order is not pending (count 0)', async () => {
      const tx = {
        order: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        orderStatusHistory: { create: jest.fn() },
      };
      await expect(
        service.markPaid(tx as unknown as Prisma.TransactionClient, 'o1'),
      ).resolves.toBe(false);
      expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
    });
  });

  describe('emitStatusEvent', () => {
    it('publishes the status event with the resolved userId', async () => {
      prisma.order.findUnique.mockResolvedValue({ userId: 'u1' });
      await service.emitStatusEvent('o1', 'SHIPPED' as never);
      expect(notifications.publishOrderStatus).toHaveBeenCalledWith({
        orderId: 'o1',
        userId: 'u1',
        status: 'SHIPPED',
      });
    });

    it('swallows a missing order (never throws)', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(
        service.emitStatusEvent('missing', 'SHIPPED' as never),
      ).resolves.toBeUndefined();
      expect(notifications.publishOrderStatus).not.toHaveBeenCalled();
    });

    it('swallows a publish failure (never throws)', async () => {
      prisma.order.findUnique.mockResolvedValue({ userId: 'u1' });
      notifications.publishOrderStatus.mockRejectedValue(new Error('queue down'));
      await expect(
        service.emitStatusEvent('o1', 'DELIVERED' as never),
      ).resolves.toBeUndefined();
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
