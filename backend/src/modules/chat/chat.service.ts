import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChatMessage, Conversation, Prisma, Sender } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { UserService } from '../iam/user/user.service';

// A conversation plus its (chronological) message history — the customer's GET and
// the admin conversation detail share this shape.
export type ChatThread = {
  conversation: Conversation;
  messages: ChatMessage[];
};

// An admin conversation row enriched with the customer's identity (resolved
// in-process, never a cross-schema JOIN) and the unread customer→admin count.
export type AdminConversation = Conversation & {
  customer: { email: string; name: string | null } | null;
  unreadCount: number;
};

// One page of admin conversations. `total` is the count over the same filter.
export type PaginatedAdminConversations = {
  items: AdminConversation[];
  total: number;
  page: number;
  pageSize: number;
};

// Cap on how many recent messages a thread read returns (portfolio-scale threads
// stay well under this; the latest are returned in chronological order).
const HISTORY_LIMIT = 200;

/**
 * Owns the `chat` schema (Conversation + ChatMessage). Persist-first: every message
 * is written to Neon here (the source of truth); the Supabase Realtime Broadcast
 * push layer is a later slice and never replaces persistence. Cross-module customer
 * identity is resolved in-process via UserService — the service only ever touches
 * `this.prisma.conversation` / `this.prisma.chatMessage` (no cross-schema JOIN).
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Resolves customer identity for admin enrichment / search (in-process, no JOIN).
    private readonly users: UserService,
    // In-process, synchronous in-app notification (NOT the order async path) so an
    // offline customer still sees an admin reply via the notification bell.
    private readonly notifications: NotificationService,
  ) {}

  // One support thread per customer. `userId` is indexed (not unique), so we
  // get-or-create by userId; a concurrent double-create is a negligible race at
  // this scale (no unique constraint added — that would need a migration).
  async getOrCreateForUser(userId: string): Promise<Conversation> {
    const existing = await this.prisma.conversation.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.conversation.create({ data: { userId } });
  }

  // The caller's own thread + recent history (latest HISTORY_LIMIT, ascending).
  async getThreadForUser(userId: string): Promise<ChatThread> {
    const conversation = await this.getOrCreateForUser(userId);
    return {
      conversation,
      messages: await this.recentMessages(conversation.id),
    };
  }

  // Persist a customer message FIRST (source of truth), stamping lastMessageAt in
  // the same transaction so the sort key never disagrees with the row.
  async sendAsUser(userId: string, body: string): Promise<ChatMessage> {
    const conversation = await this.getOrCreateForUser(userId);
    return this.appendMessage(conversation.id, Sender.USER, body);
  }

  // Customer acks incoming admin messages (idempotent; returns the count updated).
  async markAdminMessagesRead(userId: string): Promise<{ updated: number }> {
    const conversation = await this.getOrCreateForUser(userId);
    const { count } = await this.prisma.chatMessage.updateMany({
      where: {
        conversationId: conversation.id,
        sender: Sender.ADMIN,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  // Admin: paginated conversations, most-recently-active first (NULLS LAST), the
  // customer enriched + unread (customer→admin) counted — all in-process, no JOIN.
  async listConversationsForAdmin(filters: {
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedAdminConversations> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 10;

    const where: Prisma.ConversationWhereInput = {};
    const search = filters.search?.trim();
    if (search) {
      // Resolve the term to user ids in-process; no match → an empty page.
      const userIds = await this.users.searchIdsByNameOrEmail(search);
      where.userId = { in: userIds };
    }

    // count + page share the same `where`, so `total` reflects the filtered set.
    const [total, rows] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        orderBy: [
          { lastMessageAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Batch-resolve customers (no N+1, no JOIN) + unread counts, map onto the page.
    const userById = new Map(
      (
        await this.users.findManyByIds([...new Set(rows.map((r) => r.userId))])
      ).map((u) => [u.id, u]),
    );
    const unreadByConv = await this.unreadCounts(rows.map((r) => r.id));

    const items: AdminConversation[] = rows.map((conversation) => {
      const user = userById.get(conversation.userId);
      return {
        ...conversation,
        customer: user ? { email: user.email, name: user.name } : null,
        unreadCount: unreadByConv.get(conversation.id) ?? 0,
      };
    });
    return { items, total, page, pageSize };
  }

  // Admin: one conversation + recent history. 404 when it doesn't exist.
  async getConversationForAdmin(conversationId: string): Promise<ChatThread> {
    const conversation = await this.assertConversation(conversationId);
    return {
      conversation,
      messages: await this.recentMessages(conversationId),
    };
  }

  // Admin reply, persisted first (404 when the conversation doesn't exist). After
  // the message commits, notify the customer (offline path — the bell) best-effort.
  async sendAsAdmin(conversationId: string, body: string): Promise<ChatMessage> {
    const conversation = await this.assertConversation(conversationId);
    const message = await this.appendMessage(conversationId, Sender.ADMIN, body);
    await this.notifyCustomer(conversation.userId, conversationId);
    return message;
  }

  // Admin acks incoming customer messages (idempotent; 404 when missing).
  async markUserMessagesRead(
    conversationId: string,
  ): Promise<{ updated: number }> {
    await this.assertConversation(conversationId);
    const { count } = await this.prisma.chatMessage.updateMany({
      where: { conversationId, sender: Sender.USER, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: count };
  }

  // --- internals -----------------------------------------------------------

  private async assertConversation(
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation;
  }

  // Latest HISTORY_LIMIT messages returned in chronological (ascending) order.
  private async recentMessages(
    conversationId: string,
  ): Promise<ChatMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    return rows.reverse();
  }

  // Create a message and bump lastMessageAt in ONE transaction (persist-first).
  private appendMessage(
    conversationId: string,
    sender: Sender,
    body: string,
  ): Promise<ChatMessage> {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: { conversationId, sender, body },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt },
      });
      return message;
    });
  }

  // Tell the customer an admin replied — a synchronous in-app notification (the
  // bell), so an offline customer still learns of the reply. Best-effort: a failure
  // is logged and swallowed, never breaking the reply. (The reverse direction —
  // customer→admin — is surfaced by the admin inbox unread badge, not a per-admin
  // notification, so there is no "which admin / fan-out to all" ambiguity.)
  private async notifyCustomer(
    userId: string,
    conversationId: string,
  ): Promise<void> {
    try {
      await this.notifications.createInApp({
        userId,
        type: 'CHAT_REPLY',
        payload: { conversationId },
      });
    } catch {
      this.logger.warn(`Chat notification failed for user ${userId}.`);
    }
  }

  // conversationId → unread (customer→admin) message count, for the admin list.
  private async unreadCounts(
    conversationIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (conversationIds.length === 0) return counts;
    const rows = await this.prisma.chatMessage.findMany({
      where: {
        conversationId: { in: conversationIds },
        sender: Sender.USER,
        readAt: null,
      },
      select: { conversationId: true },
    });
    for (const row of rows) {
      counts.set(row.conversationId, (counts.get(row.conversationId) ?? 0) + 1);
    }
    return counts;
  }
}
