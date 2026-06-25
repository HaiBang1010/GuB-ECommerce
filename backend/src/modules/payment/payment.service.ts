import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { StripeService } from './stripe.service';

// Currency is LOCKED to USD on purpose — no env override. Stripe `amount` is in
// the currency's MINOR unit; for USD (a 2-decimal currency) that unit is the
// cent, so passing order.totalCents (already integer cents) 1:1 is correct.
// A ZERO-DECIMAL currency (VND, JPY, ...) treats `amount` as whole units, so the
// same totalCents would overcharge by 100x. Switching currency must therefore be
// a deliberate code change that also converts away from the cents assumption —
// not a config flip.
const CURRENCY = 'usd';

export interface PaymentIntentResult {
  clientSecret: string;
  // The GuB Payment record id (cuid) — NOT the Stripe pi_ id. The pi_ id stays
  // server-side (Payment.stripePaymentIntentId) for reconciliation.
  paymentRecordId: string;
}

// What a processed webhook changed, surfaced out of the DB transaction so the
// caller can publish a notification event AFTER commit. `paidOrderId` is set only
// when this delivery actually flipped the order to PAID.
interface WebhookEffect {
  paidOrderId?: string;
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    // Cross-module: read the order and transition it to PAID in-process.
    private readonly orders: OrderService,
  ) {}

  /**
   * Create (or reuse) a PaymentIntent for the caller's unpaid order and return
   * its client secret. Reusing the in-flight intent makes a double-click safe;
   * the deterministic idempotency key protects the Stripe side too.
   *
   * A declined intent (Payment FAILED) is reused too: Stripe leaves the intent at
   * `requires_payment_method`, so the buyer can retry another card on the same
   * order after a refresh. Creating a fresh Payment row here would instead collide
   * on the unique stripePaymentIntentId / idempotencyKey (the idempotency key
   * returns the SAME Stripe intent) — so we MUST reuse, not re-create.
   */
  async createIntentForOrder(
    userId: string,
    orderId: string,
  ): Promise<PaymentIntentResult> {
    const order = await this.orders.getForUser(userId, orderId); // ownership → 404
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Order is not awaiting payment.');
    }

    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId,
        stripePaymentIntentId: { not: null },
        status: {
          in: [PaymentStatus.REQUIRES_PAYMENT, PaymentStatus.FAILED],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing?.stripePaymentIntentId) {
      const intent = await this.stripe.retrievePaymentIntent(
        existing.stripePaymentIntentId,
      );
      // Reset a previously-declined payment to awaiting so its state stays honest
      // while the buyer retries.
      if (existing.status === PaymentStatus.FAILED) {
        await this.prisma.payment.update({
          where: { id: existing.id },
          data: { status: PaymentStatus.REQUIRES_PAYMENT },
        });
      }
      return this.toResult(intent, existing.id);
    }

    // TODO (real checkout): guard a minimum amount. Stripe rejects very small
    // amounts (~$0.50 / 50 cents for USD), so an order total below that will fail
    // here at PaymentIntent creation — add a min-amount check before this point.
    const idempotencyKey = `order_${orderId}`;
    const intent = await this.stripe.createPaymentIntent({
      amountCents: order.totalCents,
      currency: CURRENCY,
      idempotencyKey,
      metadata: { orderId },
    });
    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        stripePaymentIntentId: intent.id,
        status: PaymentStatus.REQUIRES_PAYMENT,
        amountCents: order.totalCents,
        idempotencyKey,
      },
    });
    return this.toResult(intent, payment.id);
  }

  /**
   * Process a Stripe webhook. The signature is verified first; then the event id
   * is INSERTED into the StripeEvent ledger and the domain effect applied in ONE
   * transaction. A duplicate delivery hits the unique-id constraint (P2002) and
   * is a 200 no-op — exactly-once even though a sleeping backend triggers retries
   * (ARCHITECTURE §5.5). A genuine failure rolls back and 5xx-s so Stripe retries.
   */
  async handleWebhook(
    payload: Buffer,
    signature: string | undefined,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header.');
    }
    let event: Stripe.Event;
    try {
      event = this.stripe.constructEvent(payload, signature);
    } catch {
      throw new BadRequestException('Invalid webhook signature.');
    }

    let effect: WebhookEffect;
    try {
      effect = await this.prisma.$transaction(async (tx) => {
        // Insert FIRST — the unique id is the idempotency guard.
        await tx.stripeEvent.create({
          data: { id: event.id, type: event.type },
        });
        return this.applyEvent(tx, event);
      });
    } catch (error) {
      if (this.isDuplicate(error)) {
        return { received: true }; // already processed → no-op
      }
      throw error; // real failure → 5xx → Stripe retries
    }

    // Publish the order-status event AFTER the transaction commits (never inside
    // it) — only when THIS delivery actually flipped the order to PAID, so a
    // redelivered succeeded event (which no-ops above or flips nothing) won't
    // re-notify. Best-effort in OrderService — won't fail the webhook.
    if (effect.paidOrderId) {
      await this.orders.emitStatusEvent(effect.paidOrderId, OrderStatus.PAID);
    }
    return { received: true };
  }

  private async applyEvent(
    tx: Prisma.TransactionClient,
    event: Stripe.Event,
  ): Promise<WebhookEffect> {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        // TODO: order is resolved via stripePaymentIntentId; metadata.orderId
        // (set at PaymentIntent creation) is currently unused — consider it as a
        // fallback if this lookup misses, or drop it to keep things lean.
        const payment = await tx.payment.findUnique({
          where: { stripePaymentIntentId: intent.id },
        });
        if (!payment) return {}; // unknown intent — recorded in the ledger, ignored
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.SUCCEEDED },
        });
        const flipped = await this.orders.markPaid(tx, payment.orderId);
        return flipped ? { paidOrderId: payment.orderId } : {};
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await tx.payment.findUnique({
          where: { stripePaymentIntentId: intent.id },
        });
        if (!payment) return {}; // unknown intent — recorded in the ledger, ignored
        // ONLY mark the Payment FAILED — leave the order PENDING_PAYMENT so the
        // buyer can retry another card on the same order/intent (durable pay page).
        // A genuine abandonment is reclaimed by the TTL release-expired job, and
        // the buyer can also cancel explicitly; we do NOT release stock on a single
        // transient decline. The Stripe intent stays `requires_payment_method` and
        // is reused on retry (see createIntentForOrder).
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED },
        });
        return {};
      }
      default:
        return {}; // recorded for idempotency; no domain effect
    }
  }

  private isDuplicate(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private toResult(
    intent: Stripe.PaymentIntent,
    paymentRecordId: string,
  ): PaymentIntentResult {
    if (!intent.client_secret) {
      throw new BadRequestException('Payment intent has no client secret.');
    }
    return { clientSecret: intent.client_secret, paymentRecordId };
  }
}
