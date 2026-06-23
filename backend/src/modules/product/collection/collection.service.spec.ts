import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Collection, Prisma } from '@prisma/client';
import { ProductService } from '../product/product.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CollectionService } from './collection.service';

type CollectionDelegateMock = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

type ProductCollectionDelegateMock = {
  findMany: jest.Mock;
  createMany: jest.Mock;
  deleteMany: jest.Mock;
};

// Only the methods CollectionService is allowed to call in-process.
type ProductServiceMock = {
  assertManyExist: jest.Mock;
  getActiveByIds: jest.Mock;
};

const NOW = new Date('2026-06-23T12:00:00.000Z');

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: 'col1',
    nameVi: 'Đồ chạy bộ',
    nameEn: 'Running Gear',
    slug: 'running-gear',
    validFrom: null,
    validTo: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

describe('CollectionService', () => {
  let prisma: {
    collection: CollectionDelegateMock;
    productCollection: ProductCollectionDelegateMock;
  };
  let productService: ProductServiceMock;
  let service: CollectionService;

  beforeEach(() => {
    // NOTE: the prisma mock exposes `collection` and `productCollection` delegates
    // but NO `product` delegate — any direct product query would throw, so the
    // boundary is enforced structurally.
    prisma = {
      collection: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productCollection: {
        findMany: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    productService = {
      assertManyExist: jest.fn().mockResolvedValue(undefined),
      getActiveByIds: jest.fn().mockResolvedValue([]),
    };
    service = new CollectionService(
      prisma as unknown as PrismaService,
      productService as unknown as ProductService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    it('creates a collection with a season window', async () => {
      const created = makeCollection();
      prisma.collection.create.mockResolvedValue(created);
      await expect(
        service.create({
          nameVi: 'a',
          nameEn: 'b',
          slug: 'running-gear',
          validFrom: new Date('2026-06-01'),
          validTo: new Date('2026-09-01'),
        }),
      ).resolves.toEqual(created);
    });

    it('rejects a window whose start is after its end (no write)', async () => {
      await expect(
        service.create({
          nameVi: 'a',
          nameEn: 'b',
          slug: 'x',
          validFrom: new Date('2026-09-01'),
          validTo: new Date('2026-06-01'),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.collection.create).not.toHaveBeenCalled();
    });

    it('maps a unique-slug violation to ConflictException', async () => {
      prisma.collection.create.mockRejectedValue(p2002());
      await expect(
        service.create({ nameVi: 'a', nameEn: 'b', slug: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('throws NotFound when the collection is missing', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { nameEn: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('validates the window against effective bounds (existing from + incoming to)', async () => {
      prisma.collection.findUnique.mockResolvedValue(
        makeCollection({ validFrom: new Date('2026-09-01') }),
      );
      await expect(
        service.update('col1', { validTo: new Date('2026-06-01') }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.collection.update).not.toHaveBeenCalled();
    });

    it('clears a bound when set to null', async () => {
      prisma.collection.findUnique.mockResolvedValue(
        makeCollection({ validTo: new Date('2026-09-01') }),
      );
      const updated = makeCollection({ validTo: null });
      prisma.collection.update.mockResolvedValue(updated);
      await expect(
        service.update('col1', { validTo: null }),
      ).resolves.toEqual(updated);
      expect(prisma.collection.update).toHaveBeenCalledWith({
        where: { id: 'col1' },
        data: { validTo: null },
      });
    });

    it('maps a slug conflict on update to ConflictException', async () => {
      prisma.collection.findUnique.mockResolvedValue(makeCollection());
      prisma.collection.update.mockRejectedValue(p2002());
      await expect(
        service.update('col1', { slug: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('archive', () => {
    it('sets archivedAt for an active collection', async () => {
      prisma.collection.findUnique.mockResolvedValue(
        makeCollection({ archivedAt: null }),
      );
      const archived = makeCollection({ archivedAt: new Date() });
      prisma.collection.update.mockResolvedValue(archived);
      await expect(service.archive('col1')).resolves.toEqual(archived);
      expect(prisma.collection.update).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when already archived (no write)', async () => {
      const already = makeCollection({ archivedAt: new Date('2026-01-01') });
      prisma.collection.findUnique.mockResolvedValue(already);
      await expect(service.archive('col1')).resolves.toEqual(already);
      expect(prisma.collection.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when missing', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(service.archive('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getActiveList', () => {
    it('hides collections outside their validity window', async () => {
      jest.useFakeTimers().setSystemTime(NOW);
      prisma.collection.findMany.mockResolvedValue([
        makeCollection({ id: 'always', validFrom: null, validTo: null }),
        makeCollection({
          id: 'live',
          validFrom: new Date('2026-06-01'),
          validTo: new Date('2026-09-01'),
        }),
        makeCollection({
          id: 'future',
          validFrom: new Date('2026-12-01'),
        }),
        makeCollection({ id: 'past', validTo: new Date('2026-01-31') }),
      ]);
      const result = await service.getActiveList();
      expect(result.map((c) => c.id)).toEqual(['always', 'live']);
    });
  });

  describe('getActiveBySlug', () => {
    it('returns an active in-window collection', async () => {
      jest.useFakeTimers().setSystemTime(NOW);
      const collection = makeCollection();
      prisma.collection.findUnique.mockResolvedValue(collection);
      await expect(service.getActiveBySlug('running-gear')).resolves.toEqual(
        collection,
      );
    });

    it('throws NotFound for an archived collection', async () => {
      prisma.collection.findUnique.mockResolvedValue(
        makeCollection({ archivedAt: new Date() }),
      );
      await expect(
        service.getActiveBySlug('running-gear'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound for a season outside its window', async () => {
      jest.useFakeTimers().setSystemTime(NOW);
      prisma.collection.findUnique.mockResolvedValue(
        makeCollection({ validFrom: new Date('2026-12-01') }),
      );
      await expect(
        service.getActiveBySlug('running-gear'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getActiveProducts', () => {
    it('resolves member products through ProductService (active + visible)', async () => {
      jest.useFakeTimers().setSystemTime(NOW);
      prisma.collection.findUnique.mockResolvedValue(
        makeCollection({ id: 'col1' }),
      );
      prisma.productCollection.findMany.mockResolvedValue([
        { productId: 'p1' },
        { productId: 'p2' },
      ]);
      productService.getActiveByIds.mockResolvedValue([{ id: 'p1' }]);

      const result = await service.getActiveProducts('running-gear');
      expect(productService.getActiveByIds).toHaveBeenCalledWith(['p1', 'p2']);
      expect(result).toEqual([{ id: 'p1' }]);
    });
  });

  describe('addProducts', () => {
    it('validates products via ProductService, then attaches them', async () => {
      prisma.collection.findUnique.mockResolvedValue(makeCollection());
      prisma.productCollection.createMany.mockResolvedValue({ count: 2 });
      prisma.productCollection.findMany.mockResolvedValue([
        { productId: 'p1' },
        { productId: 'p2' },
      ]);

      const result = await service.addProducts('col1', ['p1', 'p2', 'p1']);
      // Deduped before validating/attaching.
      expect(productService.assertManyExist).toHaveBeenCalledWith(['p1', 'p2']);
      expect(prisma.productCollection.createMany).toHaveBeenCalledWith({
        data: [
          { collectionId: 'col1', productId: 'p1' },
          { collectionId: 'col1', productId: 'p2' },
        ],
        skipDuplicates: true,
      });
      expect(result).toEqual(['p1', 'p2']);
    });

    it('rejects an unknown product WITHOUT attaching (delegates to ProductService)', async () => {
      prisma.collection.findUnique.mockResolvedValue(makeCollection());
      productService.assertManyExist.mockRejectedValue(
        new BadRequestException('Unknown product id(s): ghost'),
      );
      await expect(
        service.addProducts('col1', ['ghost']),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.productCollection.createMany).not.toHaveBeenCalled();
    });

    it('throws NotFound when the collection is missing', async () => {
      prisma.collection.findUnique.mockResolvedValue(null);
      await expect(
        service.addProducts('missing', ['p1']),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('removeProducts', () => {
    it('detaches the given products (hard-deletes the join rows)', async () => {
      prisma.collection.findUnique.mockResolvedValue(makeCollection());
      prisma.productCollection.deleteMany.mockResolvedValue({ count: 1 });
      prisma.productCollection.findMany.mockResolvedValue([]);

      await service.removeProducts('col1', ['p1']);
      expect(prisma.productCollection.deleteMany).toHaveBeenCalledWith({
        where: { collectionId: 'col1', productId: { in: ['p1'] } },
      });
    });
  });
});
