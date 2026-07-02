import { NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { UserService } from './user.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupabaseClaims } from '../auth/supabase-jwt.service';

type UserDelegateMock = {
  upsert: jest.Mock;
  update: jest.Mock;
  findUnique: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'u@example.com',
    name: null,
    role: 'CUSTOMER',
    birthday: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function claims(overrides: Partial<SupabaseClaims> = {}): SupabaseClaims {
  return { sub: 'uuid-1', email: 'a@b.com', name: 'Alice', ...overrides };
}

describe('UserService', () => {
  let prisma: { user: UserDelegateMock };
  let service: UserService;

  beforeEach(() => {
    prisma = {
      user: {
        upsert: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    service = new UserService(prisma as unknown as PrismaService);
  });

  describe('upsertOnLogin', () => {
    it('creates the user with a blank profile and never sets role', async () => {
      prisma.user.upsert.mockResolvedValue(makeUser({ id: 'uuid-1' }));
      await service.upsertOnLogin(claims());
      // Exact match → proves `role` is absent from both create and update.
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        create: {
          id: 'uuid-1',
          email: 'a@b.com',
          name: 'Alice',
          profile: { create: {} },
        },
        update: { email: 'a@b.com', name: 'Alice' },
      });
    });

    it('omits name on update (and stores null on create) when none is provided', async () => {
      prisma.user.upsert.mockResolvedValue(makeUser({ id: 'uuid-2' }));
      await service.upsertOnLogin(claims({ sub: 'uuid-2', email: 'c@d.com', name: null }));
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { id: 'uuid-2' },
        create: {
          id: 'uuid-2',
          email: 'c@d.com',
          name: null,
          profile: { create: {} },
        },
        update: { email: 'c@d.com' },
      });
    });
  });

  describe('assertActive', () => {
    it('returns an active user', async () => {
      const user = makeUser({ id: 'u1' });
      prisma.user.findUnique.mockResolvedValue(user);
      await expect(service.assertActive('u1')).resolves.toEqual(user);
    });

    it('throws NotFound when the user is missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.assertActive('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when the user is archived', async () => {
      prisma.user.findUnique.mockResolvedValue(
        makeUser({ id: 'u1', archivedAt: new Date() }),
      );
      await expect(service.assertActive('u1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findManyByIds', () => {
    it('returns [] without querying for an empty id list', async () => {
      await expect(service.findManyByIds([])).resolves.toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('looks up users by id (in)', async () => {
      const users = [makeUser({ id: 'u1' }), makeUser({ id: 'u2' })];
      prisma.user.findMany.mockResolvedValue(users);
      await expect(service.findManyByIds(['u1', 'u2'])).resolves.toBe(users);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['u1', 'u2'] } },
      });
    });
  });

  describe('listForAdmin', () => {
    it('lists all users (empty where) with default pagination', async () => {
      prisma.user.count.mockResolvedValue(25);
      prisma.user.findMany.mockResolvedValue([]);
      const result = await service.listForAdmin({});
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, skip: 0, take: 10 }),
      );
      expect(result).toEqual(
        expect.objectContaining({ total: 25, page: 1, pageSize: 10 }),
      );
    });

    it('filters by a name/email search and applies page/pageSize', async () => {
      prisma.user.count.mockResolvedValue(3);
      prisma.user.findMany.mockResolvedValue([]);
      const result = await service.listForAdmin({
        search: ' jane ',
        page: 2,
        pageSize: 20,
      });
      const expectedWhere = {
        OR: [
          { email: { contains: 'jane', mode: 'insensitive' } },
          { name: { contains: 'jane', mode: 'insensitive' } },
        ],
      };
      expect(prisma.user.count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedWhere, skip: 20, take: 20 }),
      );
      expect(result.total).toBe(3);
    });
  });

  describe('findByIdWithProfile', () => {
    it('looks up the user including its profile relation', async () => {
      const user = makeUser({ id: 'u1' });
      prisma.user.findUnique.mockResolvedValue({ ...user, profile: null });
      await service.findByIdWithProfile('u1');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'u1' },
        include: { profile: true },
      });
    });
  });

  describe('setBirthday', () => {
    it('updates the user birthday', async () => {
      prisma.user.update.mockResolvedValue(makeUser());
      const d = new Date('1995-06-15T00:00:00.000Z');
      await service.setBirthday('u1', d);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { birthday: d },
      });
    });
  });

  describe('findIdsWithBirthdayInWindow', () => {
    it('matches birthdays in [today-7d, today] (UTC), ignoring the year', async () => {
      const today = new Date('2026-06-15T08:00:00.000Z'); // Jun 15
      prisma.user.findMany.mockResolvedValue([
        { id: 'today', birthday: new Date('1990-06-15T00:00:00.000Z') },
        { id: 'today2', birthday: new Date('2001-06-15T23:30:00.000Z') },
        { id: 'fiveDaysAgo', birthday: new Date('1995-06-10T00:00:00.000Z') },
        { id: 'edge7d', birthday: new Date('1990-06-08T00:00:00.000Z') },
        { id: 'tooOld8d', birthday: new Date('1990-06-07T00:00:00.000Z') },
        { id: 'future', birthday: new Date('1990-06-16T00:00:00.000Z') },
        { id: 'wrongMonth', birthday: new Date('1990-07-15T00:00:00.000Z') },
      ]);
      await expect(service.findIdsWithBirthdayInWindow(today)).resolves.toEqual([
        'today',
        'today2',
        'fiveDaysAgo',
        'edge7d',
      ]);
      // Only non-archived users with a birthday are fetched; the window match is
      // applied in Node (UTC).
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { birthday: { not: null }, archivedAt: null },
        select: { id: true, birthday: true },
      });
    });

    it('honours a custom window size', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'fiveDaysAgo', birthday: new Date('1995-06-10T00:00:00.000Z') },
      ]);
      // days=3 → window is Jun 12..15, so the Jun 10 birthday is excluded.
      await expect(
        service.findIdsWithBirthdayInWindow(
          new Date('2026-06-15T00:00:00.000Z'),
          3,
        ),
      ).resolves.toEqual([]);
    });

    it('observes a Feb 29 birthday on Mar 1 in a non-leap year', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'leapling', birthday: new Date('2000-02-29T00:00:00.000Z') },
      ]);
      // 2027 is non-leap → Feb 29 is observed on Mar 1, which is today.
      await expect(
        service.findIdsWithBirthdayInWindow(
          new Date('2027-03-01T00:00:00.000Z'),
        ),
      ).resolves.toEqual(['leapling']);
      // ...and NOT on Feb 28 (the day before the substitute date).
      await expect(
        service.findIdsWithBirthdayInWindow(
          new Date('2027-02-28T00:00:00.000Z'),
        ),
      ).resolves.toEqual([]);
    });

    it('matches a Feb 29 birthday on Feb 29 in a leap year', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'leapling', birthday: new Date('2000-02-29T00:00:00.000Z') },
      ]);
      // 2028 is a leap year → the real Feb 29 matches (no Mar 1 substitution).
      await expect(
        service.findIdsWithBirthdayInWindow(
          new Date('2028-02-29T00:00:00.000Z'),
        ),
      ).resolves.toEqual(['leapling']);
    });

    it('returns [] when nobody has a birthday in the window', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', birthday: new Date('1990-01-02T00:00:00.000Z') },
      ]);
      await expect(
        service.findIdsWithBirthdayInWindow(new Date('2026-06-15T00:00:00.000Z')),
      ).resolves.toEqual([]);
    });
  });

  describe('searchIdsByNameOrEmail', () => {
    it('returns [] for a blank query without querying', async () => {
      await expect(service.searchIdsByNameOrEmail('   ')).resolves.toEqual([]);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('matches name OR email (case-insensitive) and returns ids only', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      await expect(service.searchIdsByNameOrEmail(' Jane ')).resolves.toEqual([
        'u1',
        'u2',
      ]);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'Jane', mode: 'insensitive' } },
            { name: { contains: 'Jane', mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 200,
      });
    });
  });

  describe('getSignupRows', () => {
    it('selects createdAt for users in the window (asc), no cross-schema work', async () => {
      const range = {
        from: new Date('2026-06-01T00:00:00.000Z'),
        to: new Date('2026-06-30T23:59:59.999Z'),
      };
      prisma.user.findMany.mockResolvedValue([
        { createdAt: new Date('2026-06-05T00:00:00.000Z') },
      ]);
      const rows = await service.getSignupRows(range);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { createdAt: { gte: range.from, lte: range.to } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(rows).toHaveLength(1);
    });
  });
});
