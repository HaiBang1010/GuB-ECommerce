import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewService } from './review.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { ProductService } from '../product/product/product.service';
import { UserService } from '../iam/user/user.service';

// The prisma mock exposes ONLY the `review` delegate: any stray query to another
// module's table (order/product/orderItem) throws, enforcing the schema boundary
// structurally. Cross-module collaborators are their own minimal mocks.
type ReviewDelegate = {
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  aggregate: jest.Mock;
};
type OrdersMock = { getDeliveredOrderItemForUser: jest.Mock };
type ProductsMock = { assertExists: jest.Mock; findManyByIds: jest.Mock };
type UsersMock = { findManyByIds: jest.Mock };

describe('ReviewService', () => {
  let prisma: { review: ReviewDelegate };
  let orders: OrdersMock;
  let products: ProductsMock;
  let users: UsersMock;
  let service: ReviewService;

  beforeEach(() => {
    prisma = {
      review: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    orders = { getDeliveredOrderItemForUser: jest.fn() };
    products = {
      assertExists: jest.fn(),
      findManyByIds: jest.fn().mockResolvedValue([]),
    };
    users = { findManyByIds: jest.fn().mockResolvedValue([]) };
    service = new ReviewService(
      prisma as unknown as PrismaService,
      orders as unknown as OrderService,
      products as unknown as ProductService,
      users as unknown as UserService,
    );
  });

  describe('create', () => {
    it('creates a review with the productId from the order item (not the client)', async () => {
      orders.getDeliveredOrderItemForUser.mockResolvedValue({
        id: 'oi1',
        productId: 'p1',
      });
      products.assertExists.mockResolvedValue({ id: 'p1' });
      prisma.review.findFirst.mockResolvedValue(null);
      const created = { id: 'rev1', userId: 'u1', productId: 'p1' };
      prisma.review.create.mockResolvedValue(created);

      const result = await service.create('u1', {
        orderItemId: 'oi1',
        rating: 5,
        body: 'Nice',
      });

      expect(orders.getDeliveredOrderItemForUser).toHaveBeenCalledWith(
        'u1',
        'oi1',
      );
      expect(products.assertExists).toHaveBeenCalledWith('p1');
      expect(prisma.review.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          productId: 'p1',
          orderItemId: 'oi1',
          rating: 5,
          body: 'Nice',
        },
      });
      expect(result).toBe(created);
    });

    it('defaults body to null when omitted', async () => {
      orders.getDeliveredOrderItemForUser.mockResolvedValue({
        id: 'oi1',
        productId: 'p1',
      });
      products.assertExists.mockResolvedValue({ id: 'p1' });
      prisma.review.findFirst.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue({ id: 'rev1' });

      await service.create('u1', { orderItemId: 'oi1', rating: 5 });

      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ body: null }),
        }),
      );
    });

    it('propagates 404 when the order item is not owned/found', async () => {
      orders.getDeliveredOrderItemForUser.mockRejectedValue(
        new NotFoundException('Order item not found.'),
      );
      await expect(
        service.create('u1', { orderItemId: 'oi1', rating: 5 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('propagates 409 when the order is not delivered', async () => {
      orders.getDeliveredOrderItemForUser.mockRejectedValue(
        new ConflictException('Order is not delivered yet.'),
      );
      await expect(
        service.create('u1', { orderItemId: 'oi1', rating: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('rejects a second review of the same product with 409', async () => {
      orders.getDeliveredOrderItemForUser.mockResolvedValue({
        id: 'oi2',
        productId: 'p1',
      });
      products.assertExists.mockResolvedValue({ id: 'p1' });
      prisma.review.findFirst.mockResolvedValue({ id: 'rev1' });

      await expect(
        service.create('u1', { orderItemId: 'oi2', rating: 4 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.review.create).not.toHaveBeenCalled();
    });

    it('maps a unique-violation race (P2002) to 409', async () => {
      orders.getDeliveredOrderItemForUser.mockResolvedValue({
        id: 'oi1',
        productId: 'p1',
      });
      products.assertExists.mockResolvedValue({ id: 'p1' });
      prisma.review.findFirst.mockResolvedValue(null);
      prisma.review.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      await expect(
        service.create('u1', { orderItemId: 'oi1', rating: 5 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateOwn', () => {
    it('throws NotFound for a review owned by someone else', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'rev1', userId: 'other' });
      await expect(
        service.updateOwn('u1', 'rev1', { rating: 4 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.review.update).not.toHaveBeenCalled();
    });

    it('throws NotFound for a missing review', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(
        service.updateOwn('u1', 'missing', { rating: 4 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates rating and body for the owner', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'rev1', userId: 'u1' });
      const updated = { id: 'rev1', userId: 'u1', rating: 4, body: 'Smaller' };
      prisma.review.update.mockResolvedValue(updated);

      const result = await service.updateOwn('u1', 'rev1', {
        rating: 4,
        body: 'Smaller',
      });

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev1' },
        data: { rating: 4, body: 'Smaller' },
      });
      expect(result).toBe(updated);
    });

    it('writes only the provided fields (partial update)', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'rev1', userId: 'u1' });
      prisma.review.update.mockResolvedValue({ id: 'rev1' });

      await service.updateOwn('u1', 'rev1', { rating: 3 });

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev1' },
        data: { rating: 3 },
      });
    });
  });

  describe('getProductReviews', () => {
    it('returns the rating summary and the items (newest first)', async () => {
      const items = [{ id: 'rev2' }, { id: 'rev1' }];
      prisma.review.findMany.mockResolvedValue(items);
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: 4.5 },
        _count: 2,
      });

      const result = await service.getProductReviews('p1');

      expect(prisma.review.findMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.review.aggregate).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        _avg: { rating: true },
        _count: true,
      });
      expect(result).toEqual({
        summary: { average: 4.5, count: 2 },
        items,
      });
    });

    it('reports a null average and zero count for a product with no reviews', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      prisma.review.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: 0,
      });

      await expect(service.getProductReviews('p-none')).resolves.toEqual({
        summary: { average: null, count: 0 },
        items: [],
      });
    });
  });

  describe('listAllForAdmin', () => {
    it('filters to unreplied reviews (adminReply: null) when replied=false', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      await service.listAllForAdmin({ replied: false });
      expect(prisma.review.count).toHaveBeenCalledWith({
        where: { adminReply: null },
      });
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { adminReply: null } }),
      );
    });

    it('filters to replied reviews (adminReply not null) when replied=true', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      await service.listAllForAdmin({ replied: true });
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { adminReply: { not: null } } }),
      );
    });

    it('lists all (empty where) with default pagination when no filter', async () => {
      prisma.review.count.mockResolvedValue(25);
      prisma.review.findMany.mockResolvedValue([]);
      const result = await service.listAllForAdmin({});
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 10 }),
      );
      expect(result).toEqual(
        expect.objectContaining({ total: 25, page: 1, pageSize: 10 }),
      );
    });

    it('applies page/pageSize as skip/take', async () => {
      prisma.review.findMany.mockResolvedValue([]);
      await service.listAllForAdmin({ page: 3, pageSize: 20 });
      expect(prisma.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });

    it('enriches each row with product + reviewer; null when a ref is gone', async () => {
      prisma.review.findMany.mockResolvedValue([
        { id: 'r1', productId: 'p1', userId: 'u1' },
        { id: 'r2', productId: 'gone', userId: 'ghost' },
      ]);
      products.findManyByIds.mockResolvedValue([
        { id: 'p1', nameVi: 'Áo', nameEn: 'Shirt' },
      ]);
      users.findManyByIds.mockResolvedValue([
        { id: 'u1', email: 'jane@example.com', name: 'Jane' },
      ]);

      const result = await service.listAllForAdmin({});

      expect(products.findManyByIds).toHaveBeenCalledWith(['p1', 'gone']);
      expect(users.findManyByIds).toHaveBeenCalledWith(['u1', 'ghost']);
      expect(result.items[0].product).toEqual({ nameVi: 'Áo', nameEn: 'Shirt' });
      expect(result.items[0].reviewer).toEqual({
        email: 'jane@example.com',
        name: 'Jane',
      });
      expect(result.items[1].product).toBeNull();
      expect(result.items[1].reviewer).toBeNull();
    });
  });

  describe('reply', () => {
    it('throws NotFound for an unknown review', async () => {
      prisma.review.findUnique.mockResolvedValue(null);
      await expect(
        service.reply('missing', { reply: 'Thanks' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.review.update).not.toHaveBeenCalled();
    });

    it('sets the admin reply and stamps a reply time', async () => {
      prisma.review.findUnique.mockResolvedValue({ id: 'rev1' });
      const replied = { id: 'rev1', adminReply: 'Thanks' };
      prisma.review.update.mockResolvedValue(replied);

      const result = await service.reply('rev1', { reply: 'Thanks' });

      expect(prisma.review.update).toHaveBeenCalledWith({
        where: { id: 'rev1' },
        data: expect.objectContaining({
          adminReply: 'Thanks',
          adminReplyAt: expect.any(Date),
        }),
      });
      expect(result).toBe(replied);
    });
  });
});
