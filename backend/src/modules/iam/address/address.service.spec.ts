import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Address } from '@prisma/client';
import { AddressService } from './address.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';

type AddressDelegateMock = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  count: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
};

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 'a1',
    userId: 'u1',
    fullName: 'Jane Doe',
    phone: '0900000000',
    line1: '1 Main St',
    line2: null,
    ward: null,
    district: null,
    city: 'HCMC',
    country: 'VN',
    postalCode: null,
    isDefault: false,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const baseDto: CreateAddressDto = {
  fullName: 'Jane Doe',
  phone: '0900000000',
  line1: '1 Main St',
  city: 'HCMC',
};

describe('AddressService', () => {
  let prisma: { address: AddressDelegateMock; $transaction: jest.Mock };
  let service: AddressService;

  beforeEach(() => {
    prisma = {
      address: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new AddressService(prisma as unknown as PrismaService);
  });

  describe('list', () => {
    it('returns active addresses, default first', async () => {
      const rows = [makeAddress({ id: 'a1', isDefault: true })];
      prisma.address.findMany.mockResolvedValue(rows);
      await expect(service.list('u1')).resolves.toEqual(rows);
      expect(prisma.address.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1', archivedAt: null },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
    });
  });

  describe('create', () => {
    it('makes the first address the default (atomic unset + create)', async () => {
      prisma.address.count.mockResolvedValue(0);
      prisma.address.updateMany.mockReturnValue('unsetOp');
      prisma.address.create.mockReturnValue('createOp');
      const created = makeAddress({ id: 'a1', isDefault: true });
      prisma.$transaction.mockResolvedValue(['unsetResult', created]);

      await expect(service.create('u1', baseDto)).resolves.toEqual(created);
      expect(prisma.$transaction).toHaveBeenCalledWith(['unsetOp', 'createOp']);

      const arg = prisma.address.create.mock.calls[0][0];
      expect(arg.data).toMatchObject({ userId: 'u1', isDefault: true });
      // country omitted so the DB default ("VN") applies.
      expect(arg.data.country).toBeUndefined();
    });

    it('creates a non-default address directly when others exist', async () => {
      prisma.address.count.mockResolvedValue(2);
      const created = makeAddress({ id: 'a2', isDefault: false });
      prisma.address.create.mockResolvedValue(created);

      await expect(
        service.create('u1', { ...baseDto, isDefault: false }),
      ).resolves.toEqual(created);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isDefault: false }),
      });
    });

    it('clears the previous default when isDefault is requested', async () => {
      prisma.address.count.mockResolvedValue(2);
      prisma.address.updateMany.mockReturnValue('unsetOp');
      prisma.address.create.mockReturnValue('createOp');
      const created = makeAddress({ id: 'a3', isDefault: true });
      prisma.$transaction.mockResolvedValue(['unsetResult', created]);

      await expect(
        service.create('u1', { ...baseDto, isDefault: true, country: 'US' }),
      ).resolves.toEqual(created);
      expect(prisma.$transaction).toHaveBeenCalledWith(['unsetOp', 'createOp']);
      expect(prisma.address.create.mock.calls[0][0].data.country).toBe('US');
    });
  });

  describe('update', () => {
    it('updates only the provided fields of an owned address', async () => {
      prisma.address.findUnique.mockResolvedValue(
        makeAddress({ id: 'a1', userId: 'u1' }),
      );
      const updated = makeAddress({ id: 'a1', city: 'Hanoi' });
      prisma.address.update.mockResolvedValue(updated);

      await expect(
        service.update('u1', 'a1', { city: 'Hanoi' }),
      ).resolves.toEqual(updated);
      expect(prisma.address.update).toHaveBeenCalledWith({
        where: { id: 'a1' },
        data: { city: 'Hanoi' },
      });
    });

    it('throws NotFound for an address owned by someone else', async () => {
      prisma.address.findUnique.mockResolvedValue(
        makeAddress({ id: 'a1', userId: 'other' }),
      );
      await expect(
        service.update('u1', 'a1', { city: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.address.update).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('soft-deletes and drops the default flag', async () => {
      prisma.address.findUnique.mockResolvedValue(
        makeAddress({ id: 'a1', userId: 'u1', isDefault: true }),
      );
      const archived = makeAddress({
        id: 'a1',
        archivedAt: new Date(),
        isDefault: false,
      });
      prisma.address.update.mockResolvedValue(archived);

      await expect(service.archive('u1', 'a1')).resolves.toEqual(archived);
      const arg = prisma.address.update.mock.calls[0][0];
      expect(arg.where).toEqual({ id: 'a1' });
      expect(arg.data.isDefault).toBe(false);
      expect(arg.data.archivedAt).toBeInstanceOf(Date);
    });

    it('is idempotent when already archived (no write)', async () => {
      const already = makeAddress({
        id: 'a1',
        userId: 'u1',
        archivedAt: new Date('2026-01-01'),
      });
      prisma.address.findUnique.mockResolvedValue(already);
      await expect(service.archive('u1', 'a1')).resolves.toEqual(already);
      expect(prisma.address.update).not.toHaveBeenCalled();
    });

    it('throws NotFound for an unowned address', async () => {
      prisma.address.findUnique.mockResolvedValue(
        makeAddress({ id: 'a1', userId: 'other' }),
      );
      await expect(service.archive('u1', 'a1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('setDefault', () => {
    it('clears the old default and sets the new one atomically', async () => {
      prisma.address.findUnique.mockResolvedValue(
        makeAddress({ id: 'a1', userId: 'u1' }),
      );
      prisma.address.updateMany.mockReturnValue('unsetOp');
      prisma.address.update.mockReturnValue('setOp');
      const updated = makeAddress({ id: 'a1', isDefault: true });
      prisma.$transaction.mockResolvedValue(['unsetResult', updated]);

      await expect(service.setDefault('u1', 'a1')).resolves.toEqual(updated);
      expect(prisma.$transaction).toHaveBeenCalledWith(['unsetOp', 'setOp']);
    });

    it('rejects setting an archived address as default', async () => {
      prisma.address.findUnique.mockResolvedValue(
        makeAddress({ id: 'a1', userId: 'u1', archivedAt: new Date() }),
      );
      await expect(service.setDefault('u1', 'a1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getOwnedActive', () => {
    it('returns an active owned address', async () => {
      const address = makeAddress({ id: 'a1', userId: 'u1' });
      prisma.address.findUnique.mockResolvedValue(address);
      await expect(service.getOwnedActive('u1', 'a1')).resolves.toEqual(address);
    });

    it('throws NotFound when the owned address is archived', async () => {
      prisma.address.findUnique.mockResolvedValue(
        makeAddress({ id: 'a1', userId: 'u1', archivedAt: new Date() }),
      );
      await expect(service.getOwnedActive('u1', 'a1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
