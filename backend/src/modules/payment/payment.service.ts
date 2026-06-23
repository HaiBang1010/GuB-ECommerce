import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { StripeService } from './stripe.service';

// Order amounts are stored as integer cents; 'usd' keeps that 1:1. Override via
// env if the store settles in another currency.
const CURRENCY = process.env.STRIPE_CURRENCY ?? 'usd';

export interface PaymentIntentResult {
  clientSecret: string;
  paymentId: string;
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
      where: { orderId, status: PaymentStatus.REQUIRES_PAYMENT },
    });
    if (existing?.stripePaymentIntentId) {
      const intent = await this.stripe.retrievePaymentIntent(
        existing.stripePaymentIntentId,
      );
      return this.toResult(intent, existing.id);
    }

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

    try {
      await this.prisma.$transaction(async (tx) => {
        // Insert FIRST — the unique id is the idempotency guard.
        await tx.stripeEvent.create({
          data: { id: event.id, type: event.type },
        });
        await this.applyEvent(tx, event);
      });
    } catch (error) {
      if (this.isDuplicate(error)) {
        return { received: true }; // already processed → no-op
      }
      throw error; // real failure → 5xx → Stripe retries
    }
    return { received: true };
  }

  private async applyEvent(
    tx: Prisma.TransactionClient,
    event: Stripe.Event,
  ): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const payment = await tx.payment.findUnique({
          where: { stripePaymentIntentId: intent.id },
        });
        if (!payment) return; // unknown intent — recorded in the ledger, ignored
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.SUCCEEDED },
        });
        await this.orders.markPaid(tx, payment.orderId);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        // Leave the order PENDING_PAYMENT so the buyer can retry; the
        // release-expired job reclaims stock if they never succeed.
        await tx.payment.updateMany({
          where: { stripePaymentIntentId: intent.id },
          data: { status: PaymentStatus.FAILED },
        });
        break;
      }
      default:
        break; // recorded for idempotency; no domain effect
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
    paymentId: string,
  ): PaymentIntentResult {
    if (!intent.client_secret) {
      throw new BadRequestException('Payment intent has no client secret.');
    }
    return { clientSecret: intent.client_secret, paymentId };
  }
}
