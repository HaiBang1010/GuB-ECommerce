import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Product, ProductVariant } from '@prisma/client';
import { ProductService } from '../product/product.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProductVariantService } from './variant.service';

type VariantDelegateMock = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  createMany: jest.Mock;
};

// Only the methods ProductVariantService is allowed to call in-process.
type ProductServiceMock = {
  assertExists: jest.Mock;
  getActiveBySlug: jest.Mock;
  getActiveByIds: jest.Mock;
};

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 'v1',
    productId: 'p1',
    sku: 'SNEAKER-42-RED',
    size: '42',
    color: 'Red',
    priceCents: 1200,
    stockQty: 5,
    archivedAt: null,
    ...overrides,
  };
}

// ProductService returns the product; id/slug + the price fields are read here
// (the sale price drives the effective/charged price).
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    slug: 'sneaker',
    basePriceCents: 1200,
    salePriceCents: null,
    ...overrides,
  } as Product;
}

function validCreateDto() {
  return {
    productId: 'p1',
    sku: 'SNEAKER-42-RED',
    size: '42',
    color: 'Red',
    priceCents: 1200,
  };
}

function p2002(
  target?: string[] | string,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
    meta: target === undefined ? undefined : { target },
  });
}

describe('ProductVariantService', () => {
  let prisma: { productVariant: VariantDelegateMock };
  let productService: ProductServiceMock;
  let service: ProductVariantService;

  beforeEach(() => {
    // NOTE: the prisma mock exposes ONLY a `productVariant` delegate. There is no
    // `product` delegate, so any attempt to query the product table directly would
    // throw here — the boundary is enforced structurally.
    prisma = {
      productVariant: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
      },
    };
    productService = {
      assertExists: jest.fn().mockResolvedValue(makeProduct()),
      getActiveBySlug: jest.fn(),
      getActiveByIds: jest.fn(),
    };
    service = new ProductVariantService(
      prisma as unknown as PrismaService,
      productService as unknown as ProductService,
    );
  });

  describe('create', () => {
    it('validates the product via ProductService, then creates', async () => {
      const created = makeVariant();
      prisma.productVariant.create.mockResolvedValue(created);

      await expect(service.create(validCreateDto())).resolves.toEqual(created);
      expect(productService.assertExists).toHaveBeenCalledWith('p1');
      expect(prisma.productVariant.create).toHaveBeenCalledTimes(1);
    });

    it('rejects an invalid product WITHOUT writing (delegates to ProductService)', async () => {
      productService.assertExists.mockRejectedValue(
        new BadRequestException('Product does not exist.'),
      );
      await expect(service.create(validCreateDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.productVariant.create).not.toHaveBeenCalled();
    });

    it('maps an SKU conflict to a specific ConflictException', async () => {
      prisma.productVariant.create.mockRejectedValue(p2002(['sku']));
      const promise = service.create(validCreateDto());
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(
        'A variant with this SKU already exists.',
      );
    });

    it('maps a size/color combo conflict to a specific ConflictException', async () => {
      prisma.productVariant.create.mockRejectedValue(
        p2002(['productId', 'size', 'color']),
      );
      const promise = service.create(validCreateDto());
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow(
        'A variant with this size and color already exists for the product.',
      );
    });
  });

  describe('update', () => {
    it('throws NotFound when the variant is missing', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { stockQty: 3 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates only the provided fields', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(makeVariant());
      const updated = makeVariant({ stockQty: 9 });
      prisma.productVariant.update.mockResolvedValue(updated);

      await expect(service.update('v1', { stockQty: 9 })).resolves.toEqual(
        updated,
      );
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { stockQty: 9 },
      });
    });

    it('maps an SKU conflict on update to ConflictException', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(makeVariant());
      prisma.productVariant.update.mockRejectedValue(p2002(['sku']));
      await expect(
        service.update('v1', { sku: 'TAKEN' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('archive', () => {
    it('sets archivedAt for an active variant', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(
        makeVariant({ archivedAt: null }),
      );
      const archived = makeVariant({ archivedAt: new Date() });
      prisma.productVariant.update.mockResolvedValue(archived);
      await expect(service.archive('v1')).resolves.toEqual(archived);
      expect(prisma.productVariant.update).toHaveBeenCalledTimes(1);
    });

    it('is idempotent when already archived (no write)', async () => {
      const already = makeVariant({ archivedAt: new Date('2026-01-01') });
      prisma.productVariant.findUnique.mockResolvedValue(already);
      await expect(service.archive('v1')).resolves.toEqual(already);
      expect(prisma.productVariant.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when missing', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(null);
      await expect(service.archive('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('clears archivedAt', async () => {
      prisma.productVariant.findUnique.mockResolvedValue(
        makeVariant({ archivedAt: new Date() }),
      );
      const restored = makeVariant({ archivedAt: null });
      prisma.productVariant.update.mockResolvedValue(restored);
      await expect(service.restore('v1')).resolves.toEqual(restored);
      expect(prisma.productVariant.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { archivedAt: null },
      });
    });
  });

  describe('generate', () => {
    it('creates the full size×color matrix with SKUs namespaced by product slug', async () => {
      productService.assertExists.mockResolvedValue(
        makeProduct({ id: 'p1', slug: 'air-zoom' }),
      );
      prisma.productVariant.findMany
        .mockResolvedValueOnce([]) // existing combos
        .mockResolvedValueOnce([]); // final list re-query
      prisma.productVariant.createMany.mockResolvedValue({ count: 2 });

      const result = await service.generate({
        productId: 'p1',
        sizes: ['41', '42'],
        colors: ['Red'],
        priceCents: 1200,
      });

      expect(productService.assertExists).toHaveBeenCalledWith('p1');
      expect(prisma.productVariant.createMany).toHaveBeenCalledWith({
        skipDuplicates: true,
        data: [
          {
            productId: 'p1',
            sku: 'AIR-ZOOM-41-RED',
            size: '41',
            color: 'Red',
            priceCents: 1200,
            stockQty: 0,
          },
          {
            productId: 'p1',
            sku: 'AIR-ZOOM-42-RED',
            size: '42',
            color: 'Red',
            priceCents: 1200,
            stockQty: 0,
          },
        ],
      });
      expect(result.createdCount).toBe(2);
    });

    it('skips combos that already exist for the product', async () => {
      productService.assertExists.mockResolvedValue(
        makeProduct({ id: 'p1', slug: 'air-zoom' }),
      );
      prisma.productVariant.findMany
        .mockResolvedValueOnce([{ size: '41', color: 'Red' }]) // existing
        .mockResolvedValueOnce([]); // final list
      prisma.productVariant.createMany.mockResolvedValue({ count: 1 });

      await service.generate({
        productId: 'p1',
        sizes: ['41', '42'],
        colors: ['Red'],
        priceCents: 1200,
      });

      const arg = prisma.productVariant.createMany.mock.calls[0][0];
      expect(arg.data).toEqual([
        {
          productId: 'p1',
          sku: 'AIR-ZOOM-42-RED',
          size: '42',
          color: 'Red',
          priceCents: 1200,
          stockQty: 0,
        },
      ]);
    });

    it('does not call createMany when every combo already exists', async () => {
      productService.assertExists.mockResolvedValue(
        makeProduct({ id: 'p1', slug: 'air-zoom' }),
      );
      prisma.productVariant.findMany
        .mockResolvedValueOnce([{ size: '42', color: 'Red' }]) // existing
        .mockResolvedValueOnce([makeVariant()]); // final list
      const result = await service.generate({
        productId: 'p1',
        sizes: ['42'],
        colors: ['Red'],
        priceCents: 1200,
      });
      expect(prisma.productVariant.createMany).not.toHaveBeenCalled();
      expect(result.createdCount).toBe(0);
    });
  });

  describe('listForAdmin', () => {
    it('validates the product then lists all its variants', async () => {
      const variants = [makeVariant()];
      prisma.productVariant.findMany.mockResolvedValue(variants);
      await expect(service.listForAdmin('p1')).resolves.toEqual(variants);
      expect(productService.assertExists).toHaveBeenCalledWith('p1');
      expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        orderBy: [{ size: 'asc' }, { color: 'asc' }],
      });
    });
  });

  describe('getActiveForProductSlug', () => {
    it('resolves the visible product via ProductService then lists active variants', async () => {
      productService.getActiveBySlug.mockResolvedValue(makeProduct({ id: 'p9' }));
      const variants = [makeVariant({ productId: 'p9' })];
      prisma.productVariant.findMany.mockResolvedValue(variants);

      await expect(
        service.getActiveForProductSlug('sneaker'),
      ).resolves.toEqual(variants);
      expect(productService.getActiveBySlug).toHaveBeenCalledWith('sneaker');
      expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
        where: { productId: 'p9', archivedAt: null },
        orderBy: [{ size: 'asc' }, { color: 'asc' }],
      });
    });

    it('propagates NotFound when the product is not visible', async () => {
      productService.getActiveBySlug.mockRejectedValue(
        new NotFoundException('Product not found.'),
      );
      await expect(
        service.getActiveForProductSlug('ghost'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.productVariant.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getPurchasableByIds', () => {
    it('returns active variants whose product is storefront-visible, with effective price', async () => {
      const v1 = makeVariant({ id: 'v1', productId: 'p1', priceCents: 1200 });
      const v2 = makeVariant({ id: 'v2', productId: 'p2' });
      prisma.productVariant.findMany.mockResolvedValue([v1, v2]);
      // Only p1 is visible → v2 (under p2) is filtered out. p1 has no sale.
      productService.getActiveByIds.mockResolvedValue([makeProduct({ id: 'p1' })]);

      await expect(service.getPurchasableByIds(['v1', 'v2'])).resolves.toEqual([
        { ...v1, effectivePriceCents: 1200 },
      ]);
      expect(productService.getActiveByIds).toHaveBeenCalledWith(['p1', 'p2']);
    });

    it('returns [] for an empty id list without querying', async () => {
      await expect(service.getPurchasableByIds([])).resolves.toEqual([]);
      expect(prisma.productVariant.findMany).not.toHaveBeenCalled();
    });

    it('returns [] (and skips the product call) when no active variant exists', async () => {
      prisma.productVariant.findMany.mockResolvedValue([]);
      await expect(service.getPurchasableByIds(['v1'])).resolves.toEqual([]);
      expect(productService.getActiveByIds).not.toHaveBeenCalled();
    });

    // The sale-aware price the cart/order consume. The product sale applies only
    // when it undercuts the variant's own price (a sale never raises the price).
    it('applies the product sale when it undercuts the variant price', async () => {
      const v1 = makeVariant({ id: 'v1', productId: 'p1', priceCents: 1200 });
      prisma.productVariant.findMany.mockResolvedValue([v1]);
      productService.getActiveByIds.mockResolvedValue([
        makeProduct({ id: 'p1', basePriceCents: 1200, salePriceCents: 900 }),
      ]);
      const [out] = await service.getPurchasableByIds(['v1']);
      expect(out.effectivePriceCents).toBe(900);
    });

    it('charges the variant price when the product is not on sale', async () => {
      const v1 = makeVariant({ id: 'v1', productId: 'p1', priceCents: 1200 });
      prisma.productVariant.findMany.mockResolvedValue([v1]);
      productService.getActiveByIds.mockResolvedValue([
        makeProduct({ id: 'p1', salePriceCents: null }),
      ]);
      const [out] = await service.getPurchasableByIds(['v1']);
      expect(out.effectivePriceCents).toBe(1200);
    });

    it('never raises a variant cheaper than the sale (guard)', async () => {
      // The sale ($11) is above this variant's own price ($10) → keep $10.
      const v1 = makeVariant({ id: 'v1', productId: 'p1', priceCents: 1000 });
      prisma.productVariant.findMany.mockResolvedValue([v1]);
      productService.getActiveByIds.mockResolvedValue([
        makeProduct({ id: 'p1', basePriceCents: 1200, salePriceCents: 1100 }),
      ]);
      const [out] = await service.getPurchasableByIds(['v1']);
      expect(out.effectivePriceCents).toBe(1000);
    });
  });

  describe('getPurchasable', () => {
    it('returns the variant (with effective price) when purchasable', async () => {
      const v1 = makeVariant({ id: 'v1', productId: 'p1', priceCents: 1200 });
      prisma.productVariant.findMany.mockResolvedValue([v1]);
      productService.getActiveByIds.mockResolvedValue([makeProduct({ id: 'p1' })]);
      await expect(service.getPurchasable('v1')).resolves.toEqual({
        ...v1,
        effectivePriceCents: 1200,
      });
    });

    it('throws NotFound when the variant is not purchasable', async () => {
      prisma.productVariant.findMany.mockResolvedValue([]);
      await expect(service.getPurchasable('v1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('decrementForOrder', () => {
    it('atomically decrements each variant guarded by stockQty>=quantity', async () => {
      const tx = {
        productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      await service.decrementForOrder(tx as unknown as Prisma.TransactionClient, [
        { variantId: 'v1', quantity: 2 },
      ]);
      expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
        where: { id: 'v1', archivedAt: null, stockQty: { gte: 2 } },
        data: { stockQty: { decrement: 2 } },
      });
    });

    it('throws a structured Conflict naming each out-of-stock variant + available qty', async () => {
      const tx = {
        productVariant: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUnique: jest.fn().mockResolvedValue({ stockQty: 1 }),
        },
      };
      const promise = service.decrementForOrder(
        tx as unknown as Prisma.TransactionClient,
        [{ variantId: 'v1', quantity: 5 }],
      );
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await promise.catch((err: ConflictException) => {
        expect(err.getResponse()).toEqual({
          statusCode: 409,
          error: 'Conflict',
          message: 'Insufficient stock for one or more items.',
          code: 'OUT_OF_STOCK',
          items: [{ variantId: 'v1', available: 1 }],
        });
      });
    });

    it('reports every failing item, not just the first', async () => {
      const tx = {
        productVariant: {
          updateMany: jest
            .fn()
            .mockResolvedValueOnce({ count: 0 }) // v1 short
            .mockResolvedValueOnce({ count: 1 }) // v2 ok
            .mockResolvedValueOnce({ count: 0 }), // v3 short
          findUnique: jest
            .fn()
            .mockResolvedValueOnce({ stockQty: 2 })
            .mockResolvedValueOnce({ stockQty: 0 }),
        },
      };
      const promise = service.decrementForOrder(
        tx as unknown as Prisma.TransactionClient,
        [
          { variantId: 'v1', quantity: 5 },
          { variantId: 'v2', quantity: 1 },
          { variantId: 'v3', quantity: 3 },
        ],
      );
      await promise.catch((err: ConflictException) => {
        const body = err.getResponse() as { items: unknown };
        expect(body.items).toEqual([
          { variantId: 'v1', available: 2 },
          { variantId: 'v3', available: 0 },
        ]);
      });
      await expect(promise).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('releaseForOrder', () => {
    it('increments stock back for each item', async () => {
      const tx = {
        productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      await service.releaseForOrder(tx as unknown as Prisma.TransactionClient, [
        { variantId: 'v1', quantity: 3 },
      ]);
      expect(tx.productVariant.updateMany).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { stockQty: { increment: 3 } },
      });
    });
  });

  describe('getLowStockVariants', () => {
    it('queries active variants ≤ threshold and enriches names via ProductService', async () => {
      prisma.productVariant.findMany.mockResolvedValue([
        makeVariant({ id: 'v1', productId: 'p1', sku: 'S1', stockQty: 1 }),
        makeVariant({ id: 'v2', productId: 'p1', sku: 'S2', stockQty: 3 }),
      ]);
      productService.getActiveByIds.mockResolvedValue([
        makeProduct({ id: 'p1', nameVi: 'Áo', nameEn: 'Shirt' }),
      ]);

      const res = await service.getLowStockVariants(5);

      // Only active variants at/below the threshold, product table never queried directly.
      expect(prisma.productVariant.findMany).toHaveBeenCalledWith({
        where: { archivedAt: null, stockQty: { lte: 5 } },
        orderBy: [{ stockQty: 'asc' }, { sku: 'asc' }],
      });
      expect(productService.getActiveByIds).toHaveBeenCalledWith(['p1']);
      expect(res).toEqual([
        { variantId: 'v1', sku: 'S1', productId: 'p1', nameVi: 'Áo', nameEn: 'Shirt', size: '42', color: 'Red', stockQty: 1 },
        { variantId: 'v2', sku: 'S2', productId: 'p1', nameVi: 'Áo', nameEn: 'Shirt', size: '42', color: 'Red', stockQty: 3 },
      ]);
    });

    it('drops variants whose product is archived/hidden (not returned by ProductService)', async () => {
      prisma.productVariant.findMany.mockResolvedValue([
        makeVariant({ id: 'v1', productId: 'pActive', stockQty: 0 }),
        makeVariant({ id: 'v2', productId: 'pArchived', stockQty: 0 }),
      ]);
      productService.getActiveByIds.mockResolvedValue([
        makeProduct({ id: 'pActive', nameVi: 'A', nameEn: 'A' }),
      ]);

      const res = await service.getLowStockVariants(5);
      expect(res.map((r) => r.variantId)).toEqual(['v1']);
    });

    it('returns [] without a product lookup when nothing is low', async () => {
      prisma.productVariant.findMany.mockResolvedValue([]);
      const res = await service.getLowStockVariants(5);
      expect(res).toEqual([]);
      expect(productService.getActiveByIds).not.toHaveBeenCalled();
    });
  });
});
