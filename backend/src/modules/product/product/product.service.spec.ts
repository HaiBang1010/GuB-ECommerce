import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { CategoryService } from '../category/category.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductService } from './product.service';

type ProductDelegateMock = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  groupBy: jest.Mock;
};

type PrismaMock = {
  product: ProductDelegateMock;
  // searchActive runs raw SQL for tsquery/trgm; mocked here to drive orchestration
  // (the actual matching is covered by product.search.spec.ts against a real DB).
  $queryRaw: jest.Mock;
};

// Only the methods ProductService is allowed to call in-process.
type CategoryServiceMock = {
  assertActive: jest.Mock;
  isCategoryVisible: jest.Mock;
  getVisibleCategoryIds: jest.Mock;
  getActiveBySlug: jest.Mock;
};

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    categoryId: 'c1',
    nameVi: 'Giày',
    nameEn: 'Sneaker',
    slug: 'sneaker',
    descriptionVi: null,
    descriptionEn: null,
    brand: null,
    basePriceCents: 1000,
    salePriceCents: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function validCreateDto() {
  return {
    categoryId: 'c1',
    nameVi: 'Giày',
    nameEn: 'Sneaker',
    slug: 'sneaker',
    basePriceCents: 1000,
  };
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

describe('ProductService', () => {
  let prisma: PrismaMock;
  let categoryService: CategoryServiceMock;
  let service: ProductService;

  beforeEach(() => {
    // NOTE: the prisma mock exposes ONLY a `product` delegate. There is no
    // `category` delegate, so any attempt by ProductService to query the category
    // table directly would throw here — boundary enforced structurally.
    prisma = {
      product: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    categoryService = {
      assertActive: jest.fn().mockResolvedValue(undefined),
      isCategoryVisible: jest.fn().mockResolvedValue(true),
      getVisibleCategoryIds: jest.fn().mockResolvedValue(new Set<string>()),
      getActiveBySlug: jest.fn(),
    };
    service = new ProductService(
      prisma as unknown as PrismaService,
      categoryService as unknown as CategoryService,
    );
  });

  describe('countActiveByCategory', () => {
    it('maps the groupBy result to a categoryId -> count record', async () => {
      prisma.product.groupBy.mockResolvedValue([
        { categoryId: 'c1', _count: { _all: 3 } },
        { categoryId: 'c2', _count: { _all: 1 } },
      ]);

      await expect(service.countActiveByCategory()).resolves.toEqual({
        c1: 3,
        c2: 1,
      });
      expect(prisma.product.groupBy).toHaveBeenCalledWith({
        by: ['categoryId'],
        where: { archivedAt: null },
        _count: { _all: true },
      });
    });
  });

  describe('create', () => {
    it('validates the category via CategoryService, then creates', async () => {
      const created = makeProduct();
      prisma.product.create.mockResolvedValue(created);

      await expect(service.create(validCreateDto())).resolves.toEqual(created);
      expect(categoryService.assertActive).toHaveBeenCalledWith('c1');
      expect(prisma.product.create).toHaveBeenCalledTimes(1);
    });

    it('rejects an invalid category WITHOUT writing (delegates to CategoryService)', async () => {
      categoryService.assertActive.mockRejectedValue(
        new BadRequestException('Category does not exist.'),
      );
      await expect(service.create(validCreateDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('rejects a sale price not below the base price', async () => {
      await expect(
        service.create({ ...validCreateDto(), salePriceCents: 1000 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.product.create).not.toHaveBeenCalled();
    });

    it('maps a unique-slug violation to ConflictException', async () => {
      prisma.product.create.mockRejectedValue(p2002());
      await expect(service.create(validCreateDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('throws NotFound when the product is missing', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { nameEn: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('validates the category via CategoryService when re-categorizing', async () => {
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      const updated = makeProduct({ categoryId: 'c2' });
      prisma.product.update.mockResolvedValue(updated);

      await expect(
        service.update('p1', { categoryId: 'c2' }),
      ).resolves.toEqual(updated);
      expect(categoryService.assertActive).toHaveBeenCalledWith('c2');
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { category: { connect: { id: 'c2' } } },
      });
    });

    it('validates pricing against effective values (existing base + incoming sale)', async () => {
      prisma.product.findUnique.mockResolvedValue(
        makeProduct({ basePriceCents: 1000 }),
      );
      await expect(
        service.update('p1', { salePriceCents: 1000 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('clears the sale price when salePriceCents is null', async () => {
      prisma.product.findUnique.mockResolvedValue(
        makeProduct({ salePriceCents: 800 }),
      );
      const updated = makeProduct({ salePriceCents: null });
      prisma.product.update.mockResolvedValue(updated);

      await expect(
        service.update('p1', { salePriceCents: null }),
      ).resolves.toEqual(updated);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { salePriceCents: null },
      });
    });

    it('maps a slug conflict on update to ConflictException', async () => {
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      prisma.product.update.mockRejectedValue(p2002());
      await expect(
        service.update('p1', { slug: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('archive', () => {
    it('sets archivedAt for an active product', async () => {
      prisma.product.findUnique.mockResolvedValue(
        makeProduct({ archivedAt: null }),
      );
      const archived = makeProduct({ archivedAt: new Date() });
      prisma.product.update.mockResolvedValue(archived);
      await expect(service.archive('p1')).resolves.toEqual(archived);
      expect(prisma.product.update).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when already archived (no write)', async () => {
      const already = makeProduct({ archivedAt: new Date('2026-01-01') });
      prisma.product.findUnique.mockResolvedValue(already);
      await expect(service.archive('p1')).resolves.toEqual(already);
      expect(prisma.product.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when missing', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.archive('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('clears archivedAt', async () => {
      prisma.product.findUnique.mockResolvedValue(
        makeProduct({ archivedAt: new Date() }),
      );
      const restored = makeProduct({ archivedAt: null });
      prisma.product.update.mockResolvedValue(restored);
      await expect(service.restore('p1')).resolves.toEqual(restored);
      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { archivedAt: null },
      });
    });
  });

  describe('getActiveList', () => {
    it('hides products whose category is not visible (cascade)', async () => {
      prisma.product.findMany.mockResolvedValue([
        makeProduct({ id: 'p1', categoryId: 'visible' }),
        makeProduct({ id: 'p2', categoryId: 'hidden' }),
      ]);
      categoryService.getVisibleCategoryIds.mockResolvedValue(
        new Set(['visible']),
      );

      const result = await service.getActiveList();
      expect(result.map((p) => p.id)).toEqual(['p1']);
    });

    it('narrows to one category via its slug (resolved by CategoryService)', async () => {
      categoryService.getActiveBySlug.mockResolvedValue({ id: 'c9' });
      prisma.product.findMany.mockResolvedValue([
        makeProduct({ id: 'p1', categoryId: 'c9' }),
      ]);

      const result = await service.getActiveList({ categorySlug: 'tops' });
      expect(categoryService.getActiveBySlug).toHaveBeenCalledWith('tops');
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null, categoryId: 'c9' },
        orderBy: { nameEn: 'asc' },
      });
      expect(result.map((p) => p.id)).toEqual(['p1']);
    });

    it('propagates NotFound when the category slug is not visible', async () => {
      categoryService.getActiveBySlug.mockRejectedValue(
        new NotFoundException('Category not found.'),
      );
      await expect(
        service.getActiveList({ categorySlug: 'ghost' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('filters to on-sale products when onSale is set', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      categoryService.getVisibleCategoryIds.mockResolvedValue(new Set<string>());
      await service.getActiveList({ onSale: true });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null, salePriceCents: { not: null } },
        orderBy: { nameEn: 'asc' },
      });
    });

    it("orders by newest first when sort='new'", async () => {
      prisma.product.findMany.mockResolvedValue([]);
      categoryService.getVisibleCategoryIds.mockResolvedValue(new Set<string>());
      await service.getActiveList({ sort: 'new' });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('applies the limit AFTER the visibility filter (no category)', async () => {
      prisma.product.findMany.mockResolvedValue([
        makeProduct({ id: 'p1', categoryId: 'v' }),
        makeProduct({ id: 'p2', categoryId: 'v' }),
        makeProduct({ id: 'p3', categoryId: 'v' }),
      ]);
      categoryService.getVisibleCategoryIds.mockResolvedValue(new Set(['v']));
      const result = await service.getActiveList({ limit: 2 });
      expect(result.map((p) => p.id)).toEqual(['p1', 'p2']);
    });

    it('passes take to the query for a category + limit', async () => {
      categoryService.getActiveBySlug.mockResolvedValue({ id: 'c9' });
      prisma.product.findMany.mockResolvedValue([]);
      await service.getActiveList({ categorySlug: 'tops', limit: 5 });
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null, categoryId: 'c9' },
        orderBy: { nameEn: 'asc' },
        take: 5,
      });
    });
  });

  describe('searchActive', () => {
    it('returns [] for a blank query without touching the DB', async () => {
      await expect(service.searchActive('   ')).resolves.toEqual([]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('hides matches whose category is not visible (archive cascade)', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]);
      prisma.product.findMany.mockResolvedValue([
        makeProduct({ id: 'p1', categoryId: 'visible' }),
        makeProduct({ id: 'p2', categoryId: 'hidden' }),
      ]);
      categoryService.getVisibleCategoryIds.mockResolvedValue(
        new Set(['visible']),
      );

      const result = await service.searchActive('ao thun');
      expect(result.map((p) => p.id)).toEqual(['p1']);
    });

    it('preserves the rank order returned by the raw query', async () => {
      // Raw query ranks p2 above p1; findMany returns them in a different order.
      prisma.$queryRaw.mockResolvedValue([{ id: 'p2' }, { id: 'p1' }]);
      prisma.product.findMany.mockResolvedValue([
        makeProduct({ id: 'p1', categoryId: 'visible' }),
        makeProduct({ id: 'p2', categoryId: 'visible' }),
      ]);
      categoryService.getVisibleCategoryIds.mockResolvedValue(
        new Set(['visible']),
      );

      const result = await service.searchActive('shirt');
      expect(result.map((p) => p.id)).toEqual(['p2', 'p1']);
    });

    it('narrows to a category slug and skips the global visibility filter', async () => {
      categoryService.getActiveBySlug.mockResolvedValue({ id: 'c9' });
      prisma.$queryRaw.mockResolvedValue([{ id: 'p1' }]);
      prisma.product.findMany.mockResolvedValue([
        makeProduct({ id: 'p1', categoryId: 'c9' }),
      ]);

      const result = await service.searchActive('shirt', 'tops');
      expect(result.map((p) => p.id)).toEqual(['p1']);
      expect(categoryService.getActiveBySlug).toHaveBeenCalledWith('tops');
      // The slug already proves the category is visible → no full-set lookup.
      expect(categoryService.getVisibleCategoryIds).not.toHaveBeenCalled();
    });
  });

  describe('getActiveBySlug', () => {
    it('returns an active product under a visible category', async () => {
      const product = makeProduct();
      prisma.product.findUnique.mockResolvedValue(product);
      categoryService.isCategoryVisible.mockResolvedValue(true);
      await expect(service.getActiveBySlug('sneaker')).resolves.toEqual(product);
      expect(categoryService.isCategoryVisible).toHaveBeenCalledWith('c1');
    });

    it('throws NotFound for an archived product', async () => {
      prisma.product.findUnique.mockResolvedValue(
        makeProduct({ archivedAt: new Date() }),
      );
      await expect(service.getActiveBySlug('sneaker')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when the category is not visible (cascade)', async () => {
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      categoryService.isCategoryVisible.mockResolvedValue(false);
      await expect(service.getActiveBySlug('sneaker')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findManyByIds', () => {
    it('returns [] without querying for an empty id list', async () => {
      await expect(service.findManyByIds([])).resolves.toEqual([]);
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('looks up products by id (in) with NO archive/visibility filter', async () => {
      const products = [makeProduct({ id: 'p1' }), makeProduct({ id: 'p2' })];
      prisma.product.findMany.mockResolvedValue(products);
      await expect(service.findManyByIds(['p1', 'p2'])).resolves.toBe(products);
      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['p1', 'p2'] } },
      });
      // Admin enrichment must not depend on category visibility.
      expect(categoryService.getVisibleCategoryIds).not.toHaveBeenCalled();
    });
  });
});
