import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Channel, Notification, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../iam/user/user.service';
import { QStashService } from './qstash.service';
import { ResendService } from './resend.service';

// The single async-path event: an order status change. The payload is kept
// minimal — the consumer resolves everything else (email) via services — so the
// notification module never needs to query the `ordering` schema.
export type OrderStatusEvent = {
  orderId: string;
  userId: string;
  status: OrderStatus;
};

// Which order statuses produce a notification, and the language-neutral `type`
// the frontend maps to localized text. All are channel BOTH (in-app + email).
const NOTIFY: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.PAID]: 'ORDER_PAID',
  [OrderStatus.SHIPPED]: 'ORDER_SHIPPED',
  [OrderStatus.DELIVERED]: 'ORDER_DELIVERED',
  [OrderStatus.REFUNDED]: 'ORDER_REFUNDED',
};

export type NotificationList = {
  items: Notification[];
  unreadCount: number;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    // Cross-module collaborators, called in-process (global IamModule).
    private readonly users: UserService,
    private readonly qstash: QStashService,
    private readonly resend: ResendService,
  ) {}

  // ---------------------------------------------------------------------------
  // Producer side — order modules call this post-commit.
  // ---------------------------------------------------------------------------

  /**
   * Publish an order-status event. When QStash is configured the event takes the
   * real async path (QStash → the consumer endpoint). Otherwise it DEGRADES to an
   * in-process handle so local dev still gets in-app notifications without a queue.
   */
  async publishOrderStatus(event: OrderStatusEvent): Promise<void> {
    // Short-circuit non-notify statuses so we never publish a wasted QStash
    // message (the consumer would skip it anyway). handleOrderStatusEvent guards
    // again, for a direct consumer call.
    if (!NOTIFY[event.status]) return;
    if (this.qstash.isPublishConfigured()) {
      await this.qstash.publish(event);
    } else {
      await this.handleOrderStatusEvent(event);
    }
  }

  // ---------------------------------------------------------------------------
  // Consumer side — the QStash endpoint (or the in-process degrade) calls this.
  // ---------------------------------------------------------------------------

  /**
   * Idempotently create the in-app notification for an order-status event and, for
   * channel BOTH statuses, send the email. Idempotency: the ledger id is the
   * DETERMINISTIC "<orderId>:<status>" key, inserted first inside the transaction —
   * a redelivered QStash message (or a double-emit) hits P2002 and is a no-op.
   */
  async handleOrderStatusEvent(event: OrderStatusEvent): Promise<void> {
    const type = NOTIFY[event.status];
    if (!type) return; // not a notify-worthy status

    const dedupId = `${event.orderId}:${event.status}`;
    try {
      await this.prisma.$transaction(async (tx) => {
        // Insert the ledger row FIRST — the unique id is the idempotency guard.
        await tx.qStashEvent.create({ data: { id: dedupId } });
        await tx.notification.create({
          data: {
            userId: event.userId,
            type,
            channel: Channel.BOTH,
            payload: { orderId: event.orderId },
          },
        });
      });
    } catch (error) {
      if (this.isDuplicate(error)) {
        return; // already processed → no-op
      }
      throw error; // real failure → 5xx → QStash retries
    }

    // Email is best-effort and OUTSIDE the transaction — a Resend failure must not
    // roll back the in-app notification or trigger a retry storm.
    await this.sendEmail(event);
  }

  private async sendEmail(event: OrderStatusEvent): Promise<void> {
    if (!this.resend.isConfigured()) return; // degrade — in-app only
    try {
      const user = await this.users.findById(event.userId);
      if (!user?.email) return;
      await this.resend.sendOrderStatusEmail({
        to: user.email,
        status: event.status,
        orderId: event.orderId,
      });
    } catch {
      // No PII in the log — only the order id + status.
      this.logger.warn(
        `Email send failed for order ${event.orderId} (${event.status}).`,
      );
    }
  }

  private isDuplicate(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  // ---------------------------------------------------------------------------
  // User-facing reads/writes (owner-scoped in the service).
  // ---------------------------------------------------------------------------

  async listForUser(userId: string): Promise<NotificationList> {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unreadCount };
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification not found.');
    }
    if (notification.readAt) {
      return notification; // idempotent
    }
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
