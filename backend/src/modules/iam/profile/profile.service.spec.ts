import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileService } from './profile.service';

// Direct-instantiate with a hand-rolled Prisma mock (the project convention — see
// address.service.spec.ts). Only the profile delegate is exposed, so a stray query
// elsewhere would throw.
describe('ProfileService', () => {
  let prisma: { profile: { findUnique: jest.Mock; upsert: jest.Mock } };
  let service: ProfileService;

  const userId = 'user-1';

  beforeEach(() => {
    prisma = {
      profile: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    service = new ProfileService(prisma as unknown as PrismaService);
  });

  describe('getByUserId', () => {
    it('returns the profile row', async () => {
      const row = {
        id: 'p1',
        userId,
        heightCm: 175,
        weightKg: 68,
        measurements: { chest: 96 },
      };
      prisma.profile.findUnique.mockResolvedValue(row);

      await expect(service.getByUserId(userId)).resolves.toBe(row);
      expect(prisma.profile.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('returns null when no row exists', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);
      await expect(service.getByUserId(userId)).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('upserts only the provided fields', async () => {
      prisma.profile.upsert.mockResolvedValue({ id: 'p1' });

      await service.update(userId, { heightCm: 180 });

      expect(prisma.profile.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: { userId, heightCm: 180 },
        update: { heightCm: 180 },
      });
    });

    it('replaces measurements wholesale when provided', async () => {
      prisma.profile.upsert.mockResolvedValue({ id: 'p1' });

      await service.update(userId, {
        weightKg: 70,
        measurements: { chest: 100, footLength: 26.5 },
      });

      expect(prisma.profile.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: {
          userId,
          weightKg: 70,
          measurements: { chest: 100, footLength: 26.5 },
        },
        update: {
          weightKg: 70,
          measurements: { chest: 100, footLength: 26.5 },
        },
      });
    });

    it('writes nothing extra for an empty update', async () => {
      prisma.profile.upsert.mockResolvedValue({ id: 'p1' });

      await service.update(userId, {});

      expect(prisma.profile.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: { userId },
        update: {},
      });
    });
  });
});
