import { Injectable, InternalServerErrorException } from '@nestjs/common';
import Stripe from 'stripe';

export interface CreateIntentParams {
  amountCents: number;
  currency: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
}

/**
 * Thin wrapper around the Stripe SDK. The secret key never leaves the backend.
 * Config is resolved LAZILY (like CloudinaryService) so the app boots without
 * Stripe env; only the payment endpoints need it. Fails CLOSED when unset.
 */
@Injectable()
export class StripeService {
  private client?: Stripe;

  // Idempotency-keyed so a retried createIntent for the same order never creates
  // a duplicate PaymentIntent. automatic_payment_methods lets Stripe pick the
  // enabled methods (card, etc.) without us hardcoding them.
  // async so a fail-closed config error surfaces as a rejected promise, not a
  // synchronous throw.
  async createPaymentIntent(
    params: CreateIntentParams,
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe().paymentIntents.create(
      {
        amount: params.amountCents,
        currency: params.currency,
        metadata: params.metadata,
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  async retrievePaymentIntent(id: string): Promise<Stripe.PaymentIntent> {
    return this.stripe().paymentIntents.retrieve(id);
  }

  // Full-refund a charged PaymentIntent. Idempotency-keyed (one key per order) so a
  // retried admin refund — or a DB failure that re-runs the orchestration — never
  // issues a second refund: Stripe returns the SAME Refund for a repeated key.
  async refundPaymentIntent(
    paymentIntentId: string,
    idempotencyKey: string,
  ): Promise<Stripe.Refund> {
    return this.stripe().refunds.create(
      { payment_intent: paymentIntentId },
      { idempotencyKey },
    );
  }

  // Verifies the Stripe-Signature header against the raw body; throws if the
  // signature is invalid (the caller maps that to a 400).
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.stripe().webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret(),
    );
  }

  private stripe(): Stripe {
    if (!this.client) {
      const key = process.env.STRIPE_SECRET_KEY;
      if (!key) {
        throw new InternalServerErrorException('Stripe is not configured.');
      }
      // apiVersion omitted → the account's default pinned version is used.
      this.client = new Stripe(key);
    }
    return this.client;
  }

  private webhookSecret(): string {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new InternalServerErrorException(
        'Stripe webhook secret is not configured.',
      );
    }
    return secret;
  }
}
