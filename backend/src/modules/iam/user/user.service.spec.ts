import { NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { UserService } from './user.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupabaseClaims } from '../auth/supabase-jwt.service';

type UserDelegateMock = {
  upsert: jest.Mock;
  findUnique: jest.Mock;
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
    prisma = { user: { upsert: jest.fn(), findUnique: jest.fn() } };
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
});
