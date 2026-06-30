import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Voucher, VoucherType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../iam/user/user.service';
import { VoucherErrorCode } from './dto/voucher-error.dto';
import { VoucherService } from './voucher.service';

// The prisma mock exposes ONLY the voucher schema's own delegates (voucher +
// userVoucher): a stray query to another module's table throws, enforcing the
// boundary structurally. UserService is its own minimal mock.
type VoucherDelegate = {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};
type UserVoucherDelegate = {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
};
type UsersMock = {
  findByEmail: jest.Mock;
  findManyByIds: jest.Mock;
  findIdsWithBirthdayToday: jest.Mock;
};

function makeVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: 'vch1',
    code: 'SAVE10',
    titleVi: null,
    titleEn: null,
    descriptionVi: null,
    descriptionEn: null,
    type: VoucherType.PERCENT,
    isPublic: true,
    value: 10,
    minOrderCents: null,
    maxDiscountCents: null,
    validFrom: null,
    validTo: null,
    usageLimit: null,
    perUserLimit: null,
    usedCount: 0,
    archivedAt: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

// Capture a rejection without leaning on a private field — read getResponse().
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('Expected the promise to reject.');
}

async function expectCode(
  promise: Promise<unknown>,
  code: VoucherErrorCode,
): Promise<HttpException> {
  const err = await rejection(promise);
  expect(err).toBeInstanceOf(HttpException);
  expect((err as HttpException).getResponse()).toMatchObject({ code });
  return err as HttpException;
}

describe('VoucherService', () => {
  let prisma: { voucher: VoucherDelegate; userVoucher: UserVoucherDelegate };
  let users: UsersMock;
  let service: VoucherService;

  beforeEach(() => {
    prisma = {
      voucher: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      userVoucher: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    };
    users = {
      findByEmail: jest.fn(),
      findManyByIds: jest.fn().mockResolvedValue([]),
      findIdsWithBirthdayToday: jest.fn().mockResolvedValue([]),
    };
    service = new VoucherService(
      prisma as unknown as PrismaService,
      users as unknown as UserService,
    );
  });

  describe('computeDiscount', () => {
    it('PERCENT: floor(subtotal * value / 100)', () => {
      const v = makeVoucher({ type: VoucherType.PERCENT, value: 10 });
      expect(service.computeDiscount(v, 1999)).toBe(199); // floor(199.9)
    });

    it('PERCENT: capped at maxDiscountCents', () => {
      const v = makeVoucher({
        type: VoucherType.PERCENT,
        value: 50,
        maxDiscountCents: 500,
      });
      expect(service.computeDiscount(v, 2000)).toBe(500); // 1000 capped to 500
    });

    it('FIXED: the flat value in cents', () => {
      const v = makeVoucher({ type: VoucherType.FIXED, value: 700 });
      expect(service.computeDiscount(v, 2000)).toBe(700);
    });

    it('never exceeds the subtotal (no negative total)', () => {
      const v = makeVoucher({ type: VoucherType.FIXED, value: 5000 });
      expect(service.computeDiscount(v, 2000)).toBe(2000);
    });
  });

  describe('validate', () => {
    it('NOT_FOUND when the code does not exist', async () => {
      prisma.voucher.findUnique.mockResolvedValue(null);
      const err = await expectCode(
        service.validate('NOPE', 'u1', 2000),
        VoucherErrorCode.NOT_FOUND,
      );
      expect(err).toBeInstanceOf(NotFoundException);
    });

    it('NOT_FOUND when archived', async () => {
      prisma.voucher.findUnique.mockResolvedValue(
        makeVoucher({ archivedAt: new Date() }),
      );
      await expectCode(
        service.validate('SAVE10', 'u1', 2000),
        VoucherErrorCode.NOT_FOUND,
      );
    });

    it('normalizes the code to UPPERCASE before lookup', async () => {
      prisma.voucher.findUnique.mockResolvedValue(makeVoucher());
      await service.validate('save10', 'u1', 2000);
      expect(prisma.voucher.findUnique).toHaveBeenCalledWith({
        where: { code: 'SAVE10' },
      });
    });

    it('NOT_YET_VALID before validFrom', async () => {
      prisma.voucher.findUnique.mockResolvedValue(
        makeVoucher({ validFrom: new Date('2999-01-01') }),
      );
      await expectCode(
        service.validate('SAVE10', 'u1', 2000),
        VoucherErrorCode.NOT_YET_VALID,
      );
    });

    it('EXPIRED after validTo', async () => {
      prisma.voucher.findUnique.mockResolvedValue(
        makeVoucher({ validTo: new Date('2000-01-01') }),
      );
      await expectCode(
        service.validate('SAVE10', 'u1', 2000),
        VoucherErrorCode.EXPIRED,
      );
    });

    it('MIN_ORDER_NOT_MET below the minimum (carries minOrderCents)', async () => {
      prisma.voucher.findUnique.mockResolvedValue(
        makeVoucher({ minOrderCents: 3000 }),
      );
      const err = await expectCode(
        service.validate('SAVE10', 'u1', 2000),
        VoucherErrorCode.MIN_ORDER_NOT_MET,
      );
      expect(err.getResponse()).toMatchObject({ minOrderCents: 3000 });
    });

    it('USED_UP when the global usage limit is reached', async () => {
      prisma.voucher.findUnique.mockResolvedValue(
        makeVoucher({ usageLimit: 5, usedCount: 5 }),
      );
      const err = await expectCode(
        service.validate('SAVE10', 'u1', 2000),
        VoucherErrorCode.USED_UP,
      );
      expect(err).toBeInstanceOf(ConflictException);
    });

    it('NOT_AVAILABLE for a wallet-only voucher with no grant', async () => {
      prisma.voucher.findUnique.mockResolvedValue(
        makeVoucher({ isPublic: false }),
      );
      prisma.userVoucher.findUnique.mockResolvedValue(null);
      await expectCode(
        service.validate('SAVE10', 'u1', 2000),
        VoucherErrorCode.NOT_AVAILABLE,
      );
    });

    it('USER_LIMIT when the per-user cap is reached', async () => {
      prisma.voucher.findUnique.mockResolvedValue(
        makeVoucher({ perUserLimit: 1 }),
      );
      prisma.userVoucher.findUnique.mockResolvedValue({ usedCount: 1 });
      await expectCode(
        service.validate('SAVE10', 'u1', 2000),
        VoucherErrorCode.USER_LIMIT,
      );
    });

    it('returns the computed discount on the happy path', async () => {
      prisma.voucher.findUnique.mockResolvedValue(makeVoucher({ value: 10 }));
      const result = await service.validate('SAVE10', 'u1', 2000);
      expect(result).toEqual({
        voucher: expect.objectContaining({ id: 'vch1' }),
        voucherId: 'vch1',
        voucherCode: 'SAVE10',
        discountCents: 200,
      });
    });
  });

  describe('redeem', () => {
    type TxMock = {
      voucher: { updateMany: jest.Mock };
      userVoucher: {
        updateMany: jest.Mock;
        findUnique: jest.Mock;
        create: jest.Mock;
      };
    };
    function makeTx(): TxMock {
      return {
        voucher: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        userVoucher: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
        },
      };
    }

    it('USED_UP when the atomic global guard matches no row (race lost)', async () => {
      const tx = makeTx();
      tx.voucher.updateMany.mockResolvedValue({ count: 0 });
      await expectCode(
        service.redeem(
          tx as unknown as Prisma.TransactionClient,
          makeVoucher({ usageLimit: 1 }),
          'u1',
        ),
        VoucherErrorCode.USED_UP,
      );
      expect(tx.userVoucher.updateMany).not.toHaveBeenCalled();
    });

    it('increments an existing per-user grant row', async () => {
      const tx = makeTx();
      tx.userVoucher.updateMany.mockResolvedValue({ count: 1 });
      await service.redeem(
        tx as unknown as Prisma.TransactionClient,
        makeVoucher(),
        'u1',
      );
      expect(tx.userVoucher.create).not.toHaveBeenCalled();
    });

    it('PUBLIC first redemption creates the ledger row', async () => {
      const tx = makeTx();
      tx.userVoucher.updateMany.mockResolvedValue({ count: 0 });
      tx.userVoucher.findUnique.mockResolvedValue(null);
      await service.redeem(
        tx as unknown as Prisma.TransactionClient,
        makeVoucher({ isPublic: true }),
        'u1',
      );
      expect(tx.userVoucher.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u1',
            voucherId: 'vch1',
            usedCount: 1,
          }),
        }),
      );
    });

    it('NOT_AVAILABLE for wallet-only with no grant row', async () => {
      const tx = makeTx();
      tx.userVoucher.updateMany.mockResolvedValue({ count: 0 });
      tx.userVoucher.findUnique.mockResolvedValue(null);
      await expectCode(
        service.redeem(
          tx as unknown as Prisma.TransactionClient,
          makeVoucher({ isPublic: false }),
          'u1',
        ),
        VoucherErrorCode.NOT_AVAILABLE,
      );
      expect(tx.userVoucher.create).not.toHaveBeenCalled();
    });

    it('USER_LIMIT when the grant row exists but is at the cap', async () => {
      const tx = makeTx();
      tx.userVoucher.updateMany.mockResolvedValue({ count: 0 });
      tx.userVoucher.findUnique.mockResolvedValue({ usedCount: 1 });
      await expectCode(
        service.redeem(
          tx as unknown as Prisma.TransactionClient,
          makeVoucher({ perUserLimit: 1 }),
          'u1',
        ),
        VoucherErrorCode.USER_LIMIT,
      );
    });
  });

  describe('create', () => {
    it('rejects a PERCENT value over 100', async () => {
      await expect(
        service.create({ code: 'X', type: VoucherType.PERCENT, value: 150 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a window with validFrom >= validTo', async () => {
      await expect(
        service.create({
          code: 'X',
          type: VoucherType.FIXED,
          value: 500,
          validFrom: '2026-08-01T00:00:00.000Z',
          validTo: '2026-07-01T00:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('maps a duplicate code (P2002) to a 409', async () => {
      prisma.voucher.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );
      await expect(
        service.create({ code: 'SAVE10', type: VoucherType.FIXED, value: 500 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('stores the code UPPERCASE with safe defaults', async () => {
      prisma.voucher.create.mockResolvedValue(makeVoucher());
      await service.create({ code: 'save10', type: VoucherType.PERCENT, value: 10 });
      expect(prisma.voucher.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ code: 'SAVE10', isPublic: true }),
      });
    });
  });

  describe('grant', () => {
    it('resolves the user by email then creates the grant', async () => {
      prisma.voucher.findUnique.mockResolvedValue(makeVoucher());
      users.findByEmail.mockResolvedValue({ id: 'u1', email: 'jane@x.com' });
      prisma.userVoucher.create.mockResolvedValue({});
      await service.grant('vch1', 'jane@x.com');
      expect(users.findByEmail).toHaveBeenCalledWith('jane@x.com');
      expect(prisma.userVoucher.create).toHaveBeenCalledWith({
        data: { userId: 'u1', voucherId: 'vch1' },
      });
    });

    it('404s when no user has that email', async () => {
      prisma.voucher.findUnique.mockResolvedValue(makeVoucher());
      users.findByEmail.mockResolvedValue(null);
      await expect(service.grant('vch1', 'ghost@x.com')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.userVoucher.create).not.toHaveBeenCalled();
    });

    it('is idempotent when the user already has the voucher (P2002)', async () => {
      prisma.voucher.findUnique.mockResolvedValue(makeVoucher());
      users.findByEmail.mockResolvedValue({ id: 'u1', email: 'jane@x.com' });
      prisma.userVoucher.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );
      await expect(service.grant('vch1', 'jane@x.com')).resolves.toMatchObject({
        id: 'vch1',
      });
    });
  });

  describe('grantBirthdayVouchers', () => {
    function p2002() {
      return new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: '5.22.0',
      });
    }

    it('grants the year voucher to today’s users; an already-granted user is skipped', async () => {
      prisma.voucher.findUnique.mockResolvedValue(
        makeVoucher({ id: 'bday', isPublic: false }),
      );
      users.findIdsWithBirthdayToday.mockResolvedValue(['u1', 'u2', 'u3']);
      // u1, u2 newly created; u3 already had it (P2002) → idempotent skip.
      prisma.userVoucher.create
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(p2002());

      const result = await service.grantBirthdayVouchers();

      expect(result).toEqual({ granted: 2, skipped: 1, total: 3 });
      // Looks up the year-coded voucher.
      expect(prisma.voucher.findUnique).toHaveBeenCalledWith({
        where: { code: expect.stringMatching(/^BIRTHDAY-\d{4}$/) },
      });
      expect(prisma.userVoucher.create).toHaveBeenCalledWith({
        data: { userId: 'u1', voucherId: 'bday' },
      });
    });

    it('is idempotent on a re-run — every user already granted → 0 granted', async () => {
      prisma.voucher.findUnique.mockResolvedValue(makeVoucher({ id: 'bday' }));
      users.findIdsWithBirthdayToday.mockResolvedValue(['u1', 'u2']);
      prisma.userVoucher.create.mockRejectedValue(p2002());

      await expect(service.grantBirthdayVouchers()).resolves.toEqual({
        granted: 0,
        skipped: 2,
        total: 2,
      });
    });

    it('degrades to {0,0,0} when no birthday voucher is configured (never queries users)', async () => {
      prisma.voucher.findUnique.mockResolvedValue(null);
      await expect(service.grantBirthdayVouchers()).resolves.toEqual({
        granted: 0,
        skipped: 0,
        total: 0,
      });
      expect(users.findIdsWithBirthdayToday).not.toHaveBeenCalled();
      expect(prisma.userVoucher.create).not.toHaveBeenCalled();
    });

    it('skips an archived birthday voucher', async () => {
      prisma.voucher.findUnique.mockResolvedValue(
        makeVoucher({ archivedAt: new Date('2026-01-01') }),
      );
      await expect(service.grantBirthdayVouchers()).resolves.toEqual({
        granted: 0,
        skipped: 0,
        total: 0,
      });
      expect(users.findIdsWithBirthdayToday).not.toHaveBeenCalled();
    });

    it('is best-effort: a non-P2002 failure for one user does not abort the rest', async () => {
      prisma.voucher.findUnique.mockResolvedValue(makeVoucher({ id: 'bday' }));
      users.findIdsWithBirthdayToday.mockResolvedValue(['u1', 'u2']);
      prisma.userVoucher.create
        .mockRejectedValueOnce(new Error('db blip'))
        .mockResolvedValueOnce({});

      await expect(service.grantBirthdayVouchers()).resolves.toEqual({
        granted: 1,
        skipped: 1,
        total: 2,
      });
    });
  });

  describe('listGrantsForAdmin', () => {
    it('enriches each grant with the email + redemption state (no JOIN)', async () => {
      prisma.voucher.findUnique.mockResolvedValue(makeVoucher());
      prisma.userVoucher.findMany.mockResolvedValue([
        {
          userId: 'u1',
          voucherId: 'vch1',
          usedCount: 1,
          usedAt: new Date('2026-06-20'),
          createdAt: new Date('2026-06-10'),
        },
      ]);
      users.findManyByIds.mockResolvedValue([{ id: 'u1', email: 'jane@x.com' }]);

      const result = await service.listGrantsForAdmin('vch1');
      expect(users.findManyByIds).toHaveBeenCalledWith(['u1']);
      expect(result).toEqual([
        expect.objectContaining({
          userId: 'u1',
          email: 'jane@x.com',
          usedCount: 1,
        }),
      ]);
    });
  });
});
