import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductImage } from '@prisma/client';
import { ProductService } from '../product/product.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';
import { ProductImageService } from './image.service';

type ImageDelegateMock = {
  findMany: jest.Mock;
  findUnique: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

// Only the methods ProductImageService is allowed to call in-process.
type ProductServiceMock = {
  assertExists: jest.Mock;
  getActiveBySlug: jest.Mock;
};

type CloudinaryServiceMock = {
  signUpload: jest.Mock;
  expectedUrlPrefix: jest.Mock;
  destroy: jest.Mock;
};

const URL_PREFIX = 'https://res.cloudinary.com/test-cloud/';

function makeImage(overrides: Partial<ProductImage> = {}): ProductImage {
  return {
    id: 'img1',
    productId: 'p1',
    url: `${URL_PREFIX}image/upload/v1/gub/products/p1/abc.jpg`,
    publicId: 'gub/products/p1/abc',
    color: 'Red',
    position: 0,
    ...overrides,
  };
}

function validCreateDto() {
  return {
    productId: 'p1',
    url: `${URL_PREFIX}image/upload/v1/gub/products/p1/abc.jpg`,
    publicId: 'gub/products/p1/abc',
    color: 'Red',
  };
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.22.0',
  });
}

describe('ProductImageService', () => {
  let prisma: { productImage: ImageDelegateMock };
  let productService: ProductServiceMock;
  let cloudinary: CloudinaryServiceMock;
  let service: ProductImageService;

  beforeEach(() => {
    // NOTE: the prisma mock exposes ONLY a `productImage` delegate — no `product`
    // delegate, so a direct product query would throw; the boundary is enforced
    // structurally.
    prisma = {
      productImage: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    productService = {
      assertExists: jest.fn().mockResolvedValue(undefined),
      getActiveBySlug: jest.fn(),
    };
    cloudinary = {
      signUpload: jest.fn(),
      expectedUrlPrefix: jest.fn().mockReturnValue(URL_PREFIX),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    service = new ProductImageService(
      prisma as unknown as PrismaService,
      productService as unknown as ProductService,
      cloudinary as unknown as CloudinaryService,
    );
    // Silence the expected error log in the remote-failure test.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sign', () => {
    it('validates the product, then returns signed upload params', async () => {
      const signed = {
        cloudName: 'test-cloud',
        apiKey: 'key',
        timestamp: 1,
        folder: 'gub/products/p1',
        signature: 'sig',
      };
      cloudinary.signUpload.mockReturnValue(signed);
      await expect(service.sign('p1')).resolves.toEqual(signed);
      expect(productService.assertExists).toHaveBeenCalledWith('p1');
      expect(cloudinary.signUpload).toHaveBeenCalledWith('p1');
    });
  });

  describe('create', () => {
    it('validates the product, then persists the asset', async () => {
      const created = makeImage();
      prisma.productImage.create.mockResolvedValue(created);
      await expect(service.create(validCreateDto())).resolves.toEqual(created);
      expect(productService.assertExists).toHaveBeenCalledWith('p1');
      expect(prisma.productImage.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a url outside our Cloudinary account (no write)', async () => {
      await expect(
        service.create({
          ...validCreateDto(),
          url: 'https://evil.example.com/x.jpg',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.productImage.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid product WITHOUT writing (delegates to ProductService)', async () => {
      productService.assertExists.mockRejectedValue(
        new BadRequestException('Product does not exist.'),
      );
      await expect(service.create(validCreateDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.productImage.create).not.toHaveBeenCalled();
    });

    it('maps a duplicate publicId to ConflictException', async () => {
      prisma.productImage.create.mockRejectedValue(p2002());
      await expect(service.create(validCreateDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('listForAdmin', () => {
    it('validates the product then lists its images by position', async () => {
      const images = [makeImage()];
      prisma.productImage.findMany.mockResolvedValue(images);
      await expect(service.listForAdmin('p1')).resolves.toEqual(images);
      expect(productService.assertExists).toHaveBeenCalledWith('p1');
      expect(prisma.productImage.findMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });
    });
  });

  describe('update', () => {
    it('throws NotFound when the image is missing', async () => {
      prisma.productImage.findUnique.mockResolvedValue(null);
      await expect(
        service.update('missing', { position: 2 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('makes the image generic when color is null', async () => {
      prisma.productImage.findUnique.mockResolvedValue(makeImage());
      const updated = makeImage({ color: null });
      prisma.productImage.update.mockResolvedValue(updated);
      await expect(service.update('img1', { color: null })).resolves.toEqual(
        updated,
      );
      expect(prisma.productImage.update).toHaveBeenCalledWith({
        where: { id: 'img1' },
        data: { color: null },
      });
    });
  });

  describe('remove', () => {
    it('deletes the Cloudinary asset, then the row', async () => {
      prisma.productImage.findUnique.mockResolvedValue(makeImage());
      prisma.productImage.delete.mockResolvedValue(makeImage());
      await service.remove('img1');
      expect(cloudinary.destroy).toHaveBeenCalledWith('gub/products/p1/abc');
      expect(prisma.productImage.delete).toHaveBeenCalledWith({
        where: { id: 'img1' },
      });
    });

    it('still deletes the row when the remote asset deletion fails', async () => {
      prisma.productImage.findUnique.mockResolvedValue(makeImage());
      cloudinary.destroy.mockRejectedValue(new Error('cloudinary down'));
      prisma.productImage.delete.mockResolvedValue(makeImage());
      await expect(service.remove('img1')).resolves.toBeUndefined();
      expect(prisma.productImage.delete).toHaveBeenCalledTimes(1);
    });

    it('throws NotFound when missing (and does not call Cloudinary)', async () => {
      prisma.productImage.findUnique.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(cloudinary.destroy).not.toHaveBeenCalled();
      expect(prisma.productImage.delete).not.toHaveBeenCalled();
    });
  });

  describe('getPrimaryImageUrls', () => {
    it('returns an empty map without querying for no ids', async () => {
      await expect(service.getPrimaryImageUrls([])).resolves.toEqual(new Map());
      expect(prisma.productImage.findMany).not.toHaveBeenCalled();
    });

    it('prefers a generic (color=null) image, else the lowest-position image', async () => {
      // Returned already position-sorted (as the real orderBy would).
      prisma.productImage.findMany.mockResolvedValue([
        makeImage({ id: 'a', productId: 'p1', color: 'Red', position: 0, url: 'red.jpg' }),
        makeImage({ id: 'b', productId: 'p1', color: null, position: 1, url: 'generic.jpg' }),
        makeImage({ id: 'c', productId: 'p2', color: 'Blue', position: 0, url: 'blue.jpg' }),
      ]);
      const map = await service.getPrimaryImageUrls(['p1', 'p2', 'p3']);
      expect(map.get('p1')).toBe('generic.jpg'); // generic beats the color image
      expect(map.get('p2')).toBe('blue.jpg'); // no generic → first by position
      expect(map.has('p3')).toBe(false); // no images → absent
    });
  });

  describe('attachPrimaryImages', () => {
    it('attaches primaryImageUrl (null when the product has none)', async () => {
      prisma.productImage.findMany.mockResolvedValue([
        makeImage({ productId: 'p1', color: null, url: 'cover.jpg' }),
      ]);
      await expect(
        service.attachPrimaryImages([{ id: 'p1' }, { id: 'p2' }]),
      ).resolves.toEqual([
        { id: 'p1', primaryImageUrl: 'cover.jpg' },
        { id: 'p2', primaryImageUrl: null },
      ]);
    });
  });

  describe('getActiveForProductSlug', () => {
    it('returns that color plus generic images for a visible product', async () => {
      productService.getActiveBySlug.mockResolvedValue({ id: 'p9' });
      const images = [makeImage({ productId: 'p9' })];
      prisma.productImage.findMany.mockResolvedValue(images);

      await expect(
        service.getActiveForProductSlug('sneaker', 'Red'),
      ).resolves.toEqual(images);
      expect(productService.getActiveBySlug).toHaveBeenCalledWith('sneaker');
      expect(prisma.productImage.findMany).toHaveBeenCalledWith({
        where: { productId: 'p9', OR: [{ color: 'Red' }, { color: null }] },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });
    });

    it('returns all images when no color filter is given', async () => {
      productService.getActiveBySlug.mockResolvedValue({ id: 'p9' });
      prisma.productImage.findMany.mockResolvedValue([]);
      await service.getActiveForProductSlug('sneaker');
      expect(prisma.productImage.findMany).toHaveBeenCalledWith({
        where: { productId: 'p9' },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });
    });

    it('propagates NotFound when the product is not visible', async () => {
      productService.getActiveBySlug.mockRejectedValue(
        new NotFoundException('Product not found.'),
      );
      await expect(
        service.getActiveForProductSlug('ghost'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.productImage.findMany).not.toHaveBeenCalled();
    });
  });
});
