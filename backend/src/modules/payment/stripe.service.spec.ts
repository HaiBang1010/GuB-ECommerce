import { InternalServerErrorException } from '@nestjs/common';
import { StripeService } from './stripe.service';

// Pure config-boundary tests: the SDK itself is exercised via PaymentService with
// a mocked StripeService, so here we only assert the fail-closed behaviour.
describe('StripeService', () => {
  let service: StripeService;
  const savedKey = process.env.STRIPE_SECRET_KEY;
  const savedSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    service = new StripeService();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  afterAll(() => {
    if (savedKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = savedKey;
    if (savedSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = savedSecret;
  });

  it('fails closed when STRIPE_SECRET_KEY is unset', async () => {
    await expect(
      service.createPaymentIntent({
        amountCents: 100,
        currency: 'usd',
        idempotencyKey: 'k',
        metadata: {},
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('fails closed when STRIPE_WEBHOOK_SECRET is unset', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    expect(() => service.constructEvent(Buffer.from('x'), 'sig')).toThrow(
      InternalServerErrorException,
    );
  });

  it('refundPaymentIntent fails closed when STRIPE_SECRET_KEY is unset', async () => {
    await expect(
      service.refundPaymentIntent('pi_1', 'refund_o1'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
