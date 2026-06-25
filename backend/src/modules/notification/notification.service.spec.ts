import { NotFoundException } from '@nestjs/common';
import { Channel, OrderStatus, Prisma } from '@prisma/client';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../iam/user/user.service';
import { QStashService } from './qstash.service';
import { ResendService } from './resend.service';

// Boundary: the prisma mock exposes ONLY the `notification` + `qStashEvent`
// delegates (this module's own tables). A stray query to another schema throws.
// UserService / QStash / Resend are their own minimal mocks.
type NotificationDelegate = {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
};

describe('NotificationService', () => {
  let prisma: {
    notification: NotificationDelegate;
    qStashEvent: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let users: { findById: jest.Mock };
  let qstash: { isPublishConfigured: jest.Mock; publish: jest.Mock };
  let resend: { isConfigured: jest.Mock; sendOrderStatusEmail: jest.Mock };
  let service: NotificationService;

  beforeEach(() => {
    prisma = {
      notification: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      qStashEvent: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    users = { findById: jest.fn() };
    qstash = { isPublishConfigured: jest.fn(), publish: jest.fn() };
    resend = { isConfigured: jest.fn(), sendOrderStatusEmail: jest.fn() };
    service = new NotificationService(
      prisma as unknown as PrismaService,
      users as unknown as UserService,
      qstash as unknown as QStashService,
      resend as unknown as ResendService,
    );
  });

  // Wire $transaction to invoke the callback with a tx exposing the two delegates.
  function txOk() {
    const tx = {
      qStashEvent: { create: jest.fn() },
      notification: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation((cb: (t: unknown) => unknown) =>
      cb(tx),
    );
    return tx;
  }

  describe('handleOrderStatusEvent', () => {
    it('creates a BOTH notification (ledger first) for a notify status and emails', async () => {
      const tx = txOk();
      resend.isConfigured.mockReturnValue(true);
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await service.handleOrderStatusEvent({
        orderId: 'o1',
        userId: 'u1',
        status: OrderStatus.SHIPPED,
      });

      expect(tx.qStashEvent.create).toHaveBeenCalledWith({
        data: { id: 'o1:SHIPPED' },
      });
      expect(tx.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'u1',
          type: 'ORDER_SHIPPED',
          channel: Channel.BOTH,
          payload: { orderId: 'o1' },
        },
      });
      expect(resend.sendOrderStatusEmail).toHaveBeenCalledWith({
        to: 'a@b.com',
        status: OrderStatus.SHIPPED,
        orderId: 'o1',
      });
    });

    it('skips a non-notify status (no transaction)', async () => {
      await service.handleOrderStatusEvent({
        orderId: 'o1',
        userId: 'u1',
        status: OrderStatus.PROCESSING,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('is idempotent: a duplicate (P2002) is a no-op with no email', async () => {
      prisma.$transaction.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );
      resend.isConfigured.mockReturnValue(true);

      await expect(
        service.handleOrderStatusEvent({
          orderId: 'o1',
          userId: 'u1',
          status: OrderStatus.PAID,
        }),
      ).resolves.toBeUndefined();
      expect(resend.sendOrderStatusEmail).not.toHaveBeenCalled();
    });

    it('rethrows a non-duplicate failure so QStash retries', async () => {
      prisma.$transaction.mockRejectedValue(new Error('db down'));
      await expect(
        service.handleOrderStatusEvent({
          orderId: 'o1',
          userId: 'u1',
          status: OrderStatus.PAID,
        }),
      ).rejects.toThrow('db down');
    });

    it('degrades when Resend is unconfigured: in-app created, no email, no throw', async () => {
      const tx = txOk();
      resend.isConfigured.mockReturnValue(false);
      await service.handleOrderStatusEvent({
        orderId: 'o1',
        userId: 'u1',
        status: OrderStatus.DELIVERED,
      });
      expect(tx.notification.create).toHaveBeenCalled();
      expect(users.findById).not.toHaveBeenCalled();
      expect(resend.sendOrderStatusEmail).not.toHaveBeenCalled();
    });

    it('swallows an email failure (best-effort)', async () => {
      txOk();
      resend.isConfigured.mockReturnValue(true);
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      resend.sendOrderStatusEmail.mockRejectedValue(new Error('resend 500'));
      await expect(
        service.handleOrderStatusEvent({
          orderId: 'o1',
          userId: 'u1',
          status: OrderStatus.PAID,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('publishOrderStatus', () => {
    it('publishes to QStash when configured', async () => {
      qstash.isPublishConfigured.mockReturnValue(true);
      const event = { orderId: 'o1', userId: 'u1', status: OrderStatus.PAID };
      await service.publishOrderStatus(event);
      expect(qstash.publish).toHaveBeenCalledWith(event);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('degrades to in-process handling when QStash is unconfigured', async () => {
      qstash.isPublishConfigured.mockReturnValue(false);
      const tx = txOk();
      resend.isConfigured.mockReturnValue(false);
      await service.publishOrderStatus({
        orderId: 'o1',
        userId: 'u1',
        status: OrderStatus.PAID,
      });
      expect(qstash.publish).not.toHaveBeenCalled();
      expect(tx.notification.create).toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('throws NotFound for a notification owned by someone else', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'other',
        readAt: null,
      });
      await expect(service.markRead('u1', 'n1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('is idempotent on an already-read notification', async () => {
      const read = { id: 'n1', userId: 'u1', readAt: new Date() };
      prisma.notification.findUnique.mockResolvedValue(read);
      await expect(service.markRead('u1', 'n1')).resolves.toBe(read);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('marks an unread notification read', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 'n1',
        userId: 'u1',
        readAt: null,
      });
      prisma.notification.update.mockResolvedValue({ id: 'n1' });
      await service.markRead('u1', 'n1');
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'n1' } }),
      );
    });
  });

  describe('listForUser', () => {
    it('returns items + unread count', async () => {
      prisma.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      prisma.notification.count.mockResolvedValue(1);
      await expect(service.listForUser('u1')).resolves.toEqual({
        items: [{ id: 'n1' }],
        unreadCount: 1,
      });
    });
  });

  describe('markAllRead', () => {
    it('reports the number updated', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 3 });
      await expect(service.markAllRead('u1')).resolves.toEqual({ updated: 3 });
    });
  });
});
