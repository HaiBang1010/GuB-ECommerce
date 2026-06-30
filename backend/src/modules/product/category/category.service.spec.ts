import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';
import { CategoryService } from './category.service';
import { PrismaService } from '../../../prisma/prisma.service';

type CategoryDelegateMock = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
};

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c1',
    nameVi: 'Áo',
    nameEn: 'Tops',
    slug: 'tops',
    parentId: null,
    sizeSystem: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

describe('CategoryService', () => {
  let prisma: { category: CategoryDelegateMock };
  let service: CategoryService;

  beforeEach(() => {
    prisma = {
      category: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new CategoryService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('maps a unique-slug violation to ConflictException', async () => {
      prisma.category.create.mockRejectedValue(p2002());
      await expect(
        service.create({ nameVi: 'a', nameEn: 'b', slug: 'tops' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects a non-existent parent with BadRequestException', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ nameVi: 'a', nameEn: 'b', slug: 'x', parentId: 'nope' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an archived parent', async () => {
      prisma.category.findUnique.mockResolvedValue(
        makeCategory({ id: 'p1', archivedAt: new Date() }),
      );
      await expect(
        service.create({ nameVi: 'a', nameEn: 'b', slug: 'x', parentId: 'p1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates under a valid active parent', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategory({ id: 'p1' }));
      const created = makeCategory({ id: 'c2', slug: 'x', parentId: 'p1' });
      prisma.category.create.mockResolvedValue(created);
      await expect(
        service.create({ nameVi: 'a', nameEn: 'b', slug: 'x', parentId: 'p1' }),
      ).resolves.toEqual(created);
    });

    it('persists sizeSystem on create', async () => {
      const created = makeCategory({ id: 'c3', slug: 'shoes', sizeSystem: 'EU_SHOES' });
      prisma.category.create.mockResolvedValue(created);
      await service.create({
        nameVi: 'a',
        nameEn: 'b',
        slug: 'shoes',
        sizeSystem: 'EU_SHOES',
      });
      expect(prisma.category.create).toHaveBeenCalledWith({
        data: {
          nameVi: 'a',
          nameEn: 'b',
          slug: 'shoes',
          parentId: null,
          sizeSystem: 'EU_SHOES',
        },
      });
    });
  });

  describe('listForAdmin', () => {
    it('merges product counts and computes active child counts', async () => {
      const root = makeCategory({ id: 'c1', parentId: null });
      const child = makeCategory({ id: 'c2', parentId: 'c1' });
      const archivedChild = makeCategory({
        id: 'c3',
        parentId: 'c1',
        archivedAt: new Date(),
      });
      prisma.category.findMany.mockResolvedValue([root, child, archivedChild]);

      // c1 has one ACTIVE child (c2); the archived c3 is not counted.
      await expect(service.listForAdmin({ c1: 5, c2: 2 })).resolves.toEqual([
        { ...root, productCount: 5, childCount: 1 },
        { ...child, productCount: 2, childCount: 0 },
        { ...archivedChild, productCount: 0, childCount: 0 },
      ]);
    });
  });

  describe('update', () => {
    it('rejects making a category its own parent', async () => {
      prisma.category.findUnique.mockResolvedValueOnce(makeCategory({ id: 'c1' }));
      await expect(
        service.update('c1', { parentId: 'c1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects assigning a descendant as parent (cycle)', async () => {
      prisma.category.findUnique
        .mockResolvedValueOnce(makeCategory({ id: 'c1' })) // load existing c1
        .mockResolvedValueOnce(makeCategory({ id: 'c2', parentId: 'c1' })); // parent c2 is child of c1
      await expect(
        service.update('c1', { parentId: 'c2' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('moves to root when parentId is null', async () => {
      prisma.category.findUnique.mockResolvedValueOnce(
        makeCategory({ id: 'c1', parentId: 'p1' }),
      );
      const updated = makeCategory({ id: 'c1', parentId: null });
      prisma.category.update.mockResolvedValue(updated);
      await expect(service.update('c1', { parentId: null })).resolves.toEqual(
        updated,
      );
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { parent: { disconnect: true } },
      });
    });

    it('maps a slug conflict on update to ConflictException', async () => {
      prisma.category.findUnique.mockResolvedValueOnce(makeCategory({ id: 'c1' }));
      prisma.category.update.mockRejectedValue(p2002());
      await expect(
        service.update('c1', { slug: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws NotFound when the category is missing', async () => {
      prisma.category.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.update('missing', { nameEn: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('archive', () => {
    it('sets archivedAt for an active category', async () => {
      prisma.category.findUnique.mockResolvedValue(
        makeCategory({ id: 'c1', archivedAt: null }),
      );
      const archived = makeCategory({ id: 'c1', archivedAt: new Date() });
      prisma.category.update.mockResolvedValue(archived);
      await expect(service.archive('c1')).resolves.toEqual(archived);
      expect(prisma.category.update).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when already archived (no write)', async () => {
      const already = makeCategory({
        id: 'c1',
        archivedAt: new Date('2026-01-01'),
      });
      prisma.category.findUnique.mockResolvedValue(already);
      await expect(service.archive('c1')).resolves.toEqual(already);
      expect(prisma.category.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when missing', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.archive('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('clears archivedAt', async () => {
      prisma.category.findUnique.mockResolvedValue(
        makeCategory({ id: 'c1', archivedAt: new Date() }),
      );
      const restored = makeCategory({ id: 'c1', archivedAt: null });
      prisma.category.update.mockResolvedValue(restored);
      await expect(service.restore('c1')).resolves.toEqual(restored);
      expect(prisma.category.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { archivedAt: null },
      });
    });
  });

  describe('getActiveBySlug', () => {
    it('returns an active root category', async () => {
      const root = makeCategory({ id: 'c1', slug: 'tops', parentId: null });
      prisma.category.findUnique.mockResolvedValue(root);
      await expect(service.getActiveBySlug('tops')).resolves.toEqual(root);
    });

    it('throws NotFound for an archived category', async () => {
      prisma.category.findUnique.mockResolvedValue(
        makeCategory({ archivedAt: new Date() }),
      );
      await expect(service.getActiveBySlug('tops')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when an ancestor is archived', async () => {
      const child = makeCategory({ id: 'c2', slug: 't-shirts', parentId: 'p1' });
      const archivedParent = makeCategory({
        id: 'p1',
        parentId: null,
        archivedAt: new Date(),
      });
      prisma.category.findUnique
        .mockResolvedValueOnce(child) // lookup by slug
        .mockResolvedValueOnce(archivedParent); // ancestor walk
      await expect(service.getActiveBySlug('t-shirts')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getActiveTree', () => {
    it('nests active children under their root', async () => {
      const root = makeCategory({ id: 'r', slug: 'tops', parentId: null });
      const child = makeCategory({ id: 'k', slug: 't-shirts', parentId: 'r' });
      prisma.category.findMany.mockResolvedValue([root, child]);
      const tree = await service.getActiveTree();
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('r');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe('k');
    });

    it('drops a node whose parent is archived (cascade)', async () => {
      // Parent 'p' is archived → absent from the active set; its child must not surface.
      const orphan = makeCategory({ id: 'k', slug: 't-shirts', parentId: 'p' });
      prisma.category.findMany.mockResolvedValue([orphan]);
      const tree = await service.getActiveTree();
      expect(tree).toHaveLength(0);
    });
  });

  // Cross-module API consumed in-process by the product slice.
  describe('assertActive', () => {
    it('resolves for an active category', async () => {
      prisma.category.findUnique.mockResolvedValue(makeCategory({ id: 'c1' }));
      await expect(service.assertActive('c1')).resolves.toBeUndefined();
    });

    it('rejects a missing category', async () => {
      prisma.category.findUnique.mockResolvedValue(null);
      await expect(service.assertActive('nope')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects an archived category', async () => {
      prisma.category.findUnique.mockResolvedValue(
        makeCategory({ id: 'c1', archivedAt: new Date() }),
      );
      await expect(service.assertActive('c1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('isCategoryVisible', () => {
    it('is true for an active root', async () => {
      prisma.category.findUnique.mockResolvedValue(
        makeCategory({ id: 'c1', parentId: null }),
      );
      await expect(service.isCategoryVisible('c1')).resolves.toBe(true);
    });

    it('is false when the category itself is archived', async () => {
      prisma.category.findUnique.mockResolvedValue(
        makeCategory({ id: 'c1', archivedAt: new Date() }),
      );
      await expect(service.isCategoryVisible('c1')).resolves.toBe(false);
    });

    it('is false when an ancestor is archived', async () => {
      const child = makeCategory({ id: 'c2', parentId: 'p1' });
      const archivedParent = makeCategory({
        id: 'p1',
        parentId: null,
        archivedAt: new Date(),
      });
      prisma.category.findUnique
        .mockResolvedValueOnce(child)
        .mockResolvedValueOnce(archivedParent);
      await expect(service.isCategoryVisible('c2')).resolves.toBe(false);
    });
  });

  describe('getVisibleCategoryIds', () => {
    it('includes active roots and their active descendants', async () => {
      const root = makeCategory({ id: 'r', parentId: null });
      const child = makeCategory({ id: 'k', parentId: 'r' });
      prisma.category.findMany.mockResolvedValue([root, child]);
      const ids = await service.getVisibleCategoryIds();
      expect(ids).toEqual(new Set(['r', 'k']));
    });

    it('drops a subtree under an archived ancestor', async () => {
      // Parent 'p' is archived → absent from the active set; orphan must not appear.
      const orphan = makeCategory({ id: 'k', parentId: 'p' });
      prisma.category.findMany.mockResolvedValue([orphan]);
      const ids = await service.getVisibleCategoryIds();
      expect(ids.has('k')).toBe(false);
    });
  });
});
