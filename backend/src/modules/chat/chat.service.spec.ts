import { NotFoundException } from '@nestjs/common';
import { Sender } from '@prisma/client';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../iam/user/user.service';

// Boundary: the prisma mock exposes ONLY this module's own delegates
// (`conversation` + `chatMessage`). A stray query to another schema throws.
// UserService is its own minimal mock (in-process enrichment / search).
type ConversationDelegate = {
  findFirst: jest.Mock;
  findUnique: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};
type ChatMessageDelegate = {
  findMany: jest.Mock;
  create: jest.Mock;
  updateMany: jest.Mock;
};

describe('ChatService', () => {
  let prisma: {
    conversation: ConversationDelegate;
    chatMessage: ChatMessageDelegate;
    $transaction: jest.Mock;
  };
  let users: { findManyByIds: jest.Mock; searchIdsByNameOrEmail: jest.Mock };
  let notifications: { createInApp: jest.Mock };
  let service: ChatService;

  beforeEach(() => {
    prisma = {
      conversation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      chatMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(),
    };
    users = {
      findManyByIds: jest.fn().mockResolvedValue([]),
      searchIdsByNameOrEmail: jest.fn().mockResolvedValue([]),
    };
    notifications = { createInApp: jest.fn().mockResolvedValue({ id: 'n1' }) };
    service = new ChatService(
      prisma as unknown as PrismaService,
      users as unknown as UserService,
      notifications as unknown as NotificationService,
    );
  });

  // Wire $transaction to invoke the callback with a tx exposing the two delegates.
  function txRun() {
    const tx = {
      chatMessage: { create: jest.fn() },
      conversation: { update: jest.fn() },
    };
    prisma.$transaction.mockImplementation((cb: (t: unknown) => unknown) =>
      cb(tx),
    );
    return tx;
  }

  describe('getOrCreateForUser', () => {
    it('returns the existing conversation when present', async () => {
      const existing = { id: 'c1', userId: 'u1' };
      prisma.conversation.findFirst.mockResolvedValue(existing);
      await expect(service.getOrCreateForUser('u1')).resolves.toBe(existing);
      expect(prisma.conversation.create).not.toHaveBeenCalled();
    });

    it('creates a conversation when none exists', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);
      prisma.conversation.create.mockResolvedValue({ id: 'c2', userId: 'u1' });
      await service.getOrCreateForUser('u1');
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { userId: 'u1' },
      });
    });
  });

  describe('sendAsUser', () => {
    it('persists a USER message and bumps lastMessageAt in one tx', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1' });
      const tx = txRun();
      const created = { id: 'm1', conversationId: 'c1', createdAt: new Date() };
      tx.chatMessage.create.mockResolvedValue(created);

      await expect(service.sendAsUser('u1', 'hello')).resolves.toBe(created);
      expect(tx.chatMessage.create).toHaveBeenCalledWith({
        data: { conversationId: 'c1', sender: Sender.USER, body: 'hello' },
      });
      expect(tx.conversation.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { lastMessageAt: created.createdAt },
      });
    });
  });

  describe('getThreadForUser', () => {
    it('returns the conversation with chronological (ascending) history', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1' });
      // recentMessages fetches DESC then reverses → ascending for display.
      prisma.chatMessage.findMany.mockResolvedValue([
        { id: 'm2', createdAt: new Date('2026-07-02') },
        { id: 'm1', createdAt: new Date('2026-07-01') },
      ]);
      const thread = await service.getThreadForUser('u1');
      expect(thread.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
    });
  });

  describe('markAdminMessagesRead', () => {
    it('marks unread ADMIN messages in the caller thread read', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1' });
      prisma.chatMessage.updateMany.mockResolvedValue({ count: 2 });
      await expect(service.markAdminMessagesRead('u1')).resolves.toEqual({
        updated: 2,
      });
      expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
        where: { conversationId: 'c1', sender: Sender.ADMIN, readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe('listConversationsForAdmin', () => {
    it('paginates (defaults), enriches the customer, and counts unread', async () => {
      const rows = [
        {
          id: 'c1',
          userId: 'u1',
          lastMessageAt: new Date(),
          createdAt: new Date(),
        },
        { id: 'c2', userId: 'ghost', lastMessageAt: null, createdAt: new Date() },
      ];
      prisma.conversation.count.mockResolvedValue(2);
      prisma.conversation.findMany.mockResolvedValue(rows);
      users.findManyByIds.mockResolvedValue([
        { id: 'u1', email: 'a@b.com', name: 'Jane' },
      ]);
      prisma.chatMessage.findMany.mockResolvedValue([
        { conversationId: 'c1' },
        { conversationId: 'c1' },
      ]);

      const result = await service.listConversationsForAdmin({});
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
      expect(result.total).toBe(2);
      expect(result.items[0]).toMatchObject({
        customer: { email: 'a@b.com', name: 'Jane' },
        unreadCount: 2,
      });
      // A conversation whose iam.User row is gone → null customer, 0 unread.
      expect(result.items[1]).toMatchObject({ customer: null, unreadCount: 0 });
    });

    it('applies skip/take for a later page', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);
      await service.listConversationsForAdmin({ page: 3, pageSize: 20 });
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });

    it('resolves a search term to user ids and filters conversations by them', async () => {
      users.searchIdsByNameOrEmail.mockResolvedValue(['u1', 'u2']);
      prisma.conversation.findMany.mockResolvedValue([]);
      await service.listConversationsForAdmin({ search: 'jane' });
      expect(users.searchIdsByNameOrEmail).toHaveBeenCalledWith('jane');
      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: { in: ['u1', 'u2'] } } }),
      );
    });
  });

  describe('admin conversation access', () => {
    it('sendAsAdmin throws NotFound when the conversation is missing', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(service.sendAsAdmin('nope', 'hi')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('getConversationForAdmin throws NotFound when the conversation is missing', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(
        service.getConversationForAdmin('nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sendAsAdmin persists an ADMIN message and notifies the customer', async () => {
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      const tx = txRun();
      const created = { id: 'm9', conversationId: 'c1', createdAt: new Date() };
      tx.chatMessage.create.mockResolvedValue(created);
      await expect(service.sendAsAdmin('c1', 'sure')).resolves.toBe(created);
      expect(tx.chatMessage.create).toHaveBeenCalledWith({
        data: { conversationId: 'c1', sender: Sender.ADMIN, body: 'sure' },
      });
      // Offline path: the customer (conversation owner) gets an in-app notification.
      expect(notifications.createInApp).toHaveBeenCalledWith({
        userId: 'u1',
        type: 'CHAT_REPLY',
        payload: { conversationId: 'c1' },
      });
    });

    it('sendAsAdmin still returns the message when the notification fails (best-effort)', async () => {
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' });
      const tx = txRun();
      const created = { id: 'm9', conversationId: 'c1', createdAt: new Date() };
      tx.chatMessage.create.mockResolvedValue(created);
      notifications.createInApp.mockRejectedValue(new Error('notify down'));
      await expect(service.sendAsAdmin('c1', 'sure')).resolves.toBe(created);
    });

    it('sendAsUser does NOT notify (admin inbox unread badge covers that direction)', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1' });
      const tx = txRun();
      tx.chatMessage.create.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        createdAt: new Date(),
      });
      await service.sendAsUser('u1', 'hello');
      expect(notifications.createInApp).not.toHaveBeenCalled();
    });
  });

  describe('markUserMessagesRead', () => {
    it('throws NotFound when the conversation is missing', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(
        service.markUserMessagesRead('nope'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.chatMessage.updateMany).not.toHaveBeenCalled();
    });

    it('marks unread customer (USER) messages read', async () => {
      prisma.conversation.findUnique.mockResolvedValue({ id: 'c1' });
      prisma.chatMessage.updateMany.mockResolvedValue({ count: 3 });
      await expect(service.markUserMessagesRead('c1')).resolves.toEqual({
        updated: 3,
      });
      expect(prisma.chatMessage.updateMany).toHaveBeenCalledWith({
        where: { conversationId: 'c1', sender: Sender.USER, readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });
});
