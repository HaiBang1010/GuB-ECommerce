import { NotFoundException } from '@nestjs/common';
import { Banner } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MarketingService } from './marketing.service';

// Only the service's own `banner` delegate is mocked — a stray query to any other
// table would throw, enforcing the module boundary structurally.
type BannerDelegate = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

function makeBanner(overrides: Partial<Banner> = {}): Banner {
  return {
    id: 'bnr1',
    imageUrl: 'https://cdn.example.com/a.jpg',
    linkUrl: null,
    title: null,
    alt: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date('2026-06-30T00:00:00.000Z'),
    archivedAt: null,
    ...overrides,
  };
}

describe('MarketingService', () => {
  let prisma: { banner: BannerDelegate };
  let service: MarketingService;

  beforeEach(() => {
    prisma = {
      banner: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new MarketingService(prisma as unknown as PrismaService);
  });

  describe('listActive', () => {
    it('filters to active + non-archived, ordered by sortOrder then createdAt', async () => {
      await service.listActive();
      expect(prisma.banner.findMany).toHaveBeenCalledWith({
        where: { isActive: true, archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('listForAdmin', () => {
    it('includes inactive banners but excludes archived', async () => {
      await service.listForAdmin();
      expect(prisma.banner.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('getById', () => {
    it('returns the banner when found', async () => {
      const banner = makeBanner();
      prisma.banner.findUnique.mockResolvedValue(banner);
      await expect(service.getById('bnr1')).resolves.toBe(banner);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.banner.findUnique.mockResolvedValue(null);
      await expect(service.getById('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('applies defaults and trims/normalizes empty optionals to null', async () => {
      prisma.banner.create.mockImplementation(({ data }) =>
        makeBanner(data as Partial<Banner>),
      );
      await service.create({ imageUrl: '  https://cdn.example.com/a.jpg  ', linkUrl: '  ' });
      expect(prisma.banner.create).toHaveBeenCalledWith({
        data: {
          imageUrl: 'https://cdn.example.com/a.jpg',
          linkUrl: null,
          title: null,
          alt: null,
          sortOrder: 0,
          isActive: true,
        },
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the banner is missing', async () => {
      prisma.banner.findUnique.mockResolvedValue(null);
      await expect(service.update('nope', { sortOrder: 2 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.banner.update).not.toHaveBeenCalled();
    });

    it('only writes the provided fields', async () => {
      prisma.banner.findUnique.mockResolvedValue(makeBanner());
      prisma.banner.update.mockResolvedValue(makeBanner({ isActive: false }));
      await service.update('bnr1', { isActive: false });
      expect(prisma.banner.update).toHaveBeenCalledWith({
        where: { id: 'bnr1' },
        data: { isActive: false },
      });
    });
  });

  describe('archive', () => {
    it('sets archivedAt on an existing banner', async () => {
      prisma.banner.findUnique.mockResolvedValue(makeBanner());
      prisma.banner.update.mockResolvedValue(makeBanner({ archivedAt: new Date() }));
      await service.archive('bnr1');
      expect(prisma.banner.update).toHaveBeenCalledWith({
        where: { id: 'bnr1' },
        data: { archivedAt: expect.any(Date) },
      });
    });

    it('throws NotFoundException when missing', async () => {
      prisma.banner.findUnique.mockResolvedValue(null);
      await expect(service.archive('nope')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
