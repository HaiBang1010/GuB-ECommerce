import { Module } from '@nestjs/common';
import { NotificationConsumerController } from './notification-consumer.controller';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { QStashService } from './qstash.service';
import { ResendService } from './resend.service';

/**
 * Notification module — owns the `notification` schema (Notification + the
 * QStashEvent idempotency ledger) and implements the system's single async path:
 * order modules call `NotificationService.publishOrderStatus` in-process, which
 * either publishes to QStash (→ the consumer endpoint) or, when unconfigured,
 * handles the event in-process so local dev still gets in-app notifications.
 *
 * The event carries `{ orderId, userId, status }`, so the consumer never needs
 * OrderService — this module imports no OrderModule (no cycle). UserService (for
 * the email address) comes free from the @Global() IamModule.
 */
@Module({
  controllers: [NotificationController, NotificationConsumerController],
  providers: [NotificationService, QStashService, ResendService],
  exports: [NotificationService],
})
export class NotificationModule {}
