import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentService } from './payment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { StripeService } from './stripe.service';

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

describe('PaymentService', () => {
  let prisma: {
    payment: { findFirst: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };
  let stripe: {
    createPaymentIntent: jest.Mock;
    retrievePaymentIntent: jest.Mock;
    constructEvent: jest.Mock;
  };
  let orders: { getForUser: jest.Mock; markPaid: jest.Mock };
  let service: PaymentService;

  beforeEach(() => {
    prisma = {
      payment: { findFirst: jest.fn(), create: jest.fn() },
      $transaction: jest.fn(),
    };
    stripe = {
      createPaymentIntent: jest.fn(),
      retrievePaymentIntent: jest.fn(),
      constructEvent: jest.fn(),
    };
    orders = { getForUser: jest.fn(), markPaid: jest.fn() };
    service = new PaymentService(
      prisma as unknown as PrismaService,
      stripe as unknown as StripeService,
      orders as unknown as OrderService,
    );
  });

  describe('createIntentForOrder', () => {
    it('rejects an order that is not awaiting payment', async () => {
      orders.getForUser.mockResolvedValue({ id: 'o1', status: 'PAID', totalCents: 100 });
      await expect(
        service.createIntentForOrder('u1', 'o1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reuses the in-flight PaymentIntent when one already exists', async () => {
      orders.getForUser.mockResolvedValue({
        id: 'o1',
        status: 'PENDING_PAYMENT',
        totalCents: 2000,
      });
      prisma.payment.findFirst.mockResolvedValue({
        id: 'pay1',
        stripePaymentIntentId: 'pi_1',
      });
      stripe.retrievePaymentIntent.mockResolvedValue({
        id: 'pi_1',
        client_secret: 'cs_existing',
      });

      await expect(service.createIntentForOrder('u1', 'o1')).resolves.toEqual({
        clientSecret: 'cs_existing',
        paymentId: 'pay1',
      });
      expect(stripe.createPaymentIntent).not.toHaveBeenCalled();
    });

    it('creates a new PaymentIntent + Payment row when none exists', async () => {
      orders.getForUser.mockResolvedValue({
        id: 'o1',
        status: 'PENDING_PAYMENT',
        totalCents: 2000,
      });
      prisma.payment.findFirst.mockResolvedValue(null);
      stripe.createPaymentIntent.mockResolvedValue({
        id: 'pi_new',
        client_secret: 'cs_new',
      });
      prisma.payment.create.mockResolvedValue({ id: 'pay2' });

      const result = await service.createIntentForOrder('u1', 'o1');
      expect(stripe.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 2000,
          idempotencyKey: 'order_o1',
          metadata: { orderId: 'o1' },
        }),
      );
      expect(result).toEqual({ clientSecret: 'cs_new', paymentId: 'pay2' });
    });
  });

  describe('handleWebhook', () => {
    function txWith(parts: Record<string, unknown>) {
      return {
        stripeEvent: { create: jest.fn() },
        payment: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
        ...parts,
      };
    }

    it('rejects a missing signature', async () => {
      await expect(
        service.handleWebhook(Buffer.from('x'), undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an invalid signature', async () => {
      stripe.constructEvent.mockImplementation(() => {
        throw new Error('bad sig');
      });
      await expect(
        service.handleWebhook(Buffer.from('x'), 'sig'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks payment SUCCEEDED and the order PAID on payment_intent.succeeded', async () => {
      stripe.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1' } },
      });
      const tx = txWith({});
      tx.payment.findUnique.mockResolvedValue({ id: 'pay1', orderId: 'o1' });
      prisma.$transaction.mockImplementation(
        (cb: (t: unknown) => unknown) => cb(tx),
      );

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });
      expect(tx.stripeEvent.create).toHaveBeenCalledWith({
        data: { id: 'evt_1', type: 'payment_intent.succeeded' },
      });
      expect(tx.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay1' },
        data: { status: 'SUCCEEDED' },
      });
      expect(orders.markPaid).toHaveBeenCalledWith(tx, 'o1');
    });

    it('treats a duplicate event as a no-op (P2002 on the ledger)', async () => {
      stripe.constructEvent.mockReturnValue({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1' } },
      });
      prisma.$transaction.mockImplementation(() => {
        throw p2002();
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'sig'),
      ).resolves.toEqual({ received: true });
      expect(orders.markPaid).not.toHaveBeenCalled();
    });

    it('marks payment FAILED (order left pending) on payment_failed', async () => {
      stripe.constructEvent.mockReturnValue({
        id: 'evt_2',
        type: 'payment_intent.payment_failed',
        data: { object: { id: 'pi_1' } },
      });
      const tx = txWith({});
      prisma.$transaction.mockImplementation(
        (cb: (t: unknown) => unknown) => cb(tx),
      );

      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(tx.payment.updateMany).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: 'pi_1' },
        data: { status: 'FAILED' },
      });
      expect(orders.markPaid).not.toHaveBeenCalled();
    });
  });
});
