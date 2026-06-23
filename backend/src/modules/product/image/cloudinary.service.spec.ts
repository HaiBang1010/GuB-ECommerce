import { InternalServerErrorException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CloudinaryService } from './cloudinary.service';

const ENV_KEYS = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLOUDINARY_UPLOAD_FOLDER',
] as const;

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'key123';
    process.env.CLOUDINARY_API_SECRET = 'secret123';
    delete process.env.CLOUDINARY_UPLOAD_FOLDER; // exercise the default folder
    service = new CloudinaryService();
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    jest.useRealTimers();
  });

  it('builds the account url prefix', () => {
    expect(service.expectedUrlPrefix()).toBe(
      'https://res.cloudinary.com/test-cloud/',
    );
  });

  it('signs an upload to the default product folder with a correct sha1', () => {
    const ts = 1_700_000_000;
    jest.useFakeTimers().setSystemTime(new Date(ts * 1000));

    const signed = service.signUpload('p1');

    expect(signed).toMatchObject({
      cloudName: 'test-cloud',
      apiKey: 'key123',
      timestamp: ts,
      folder: 'gub/products/p1',
    });
    // Independently recompute the Cloudinary signature.
    const expected = createHash('sha1')
      .update(`folder=gub/products/p1&timestamp=${ts}` + 'secret123')
      .digest('hex');
    expect(signed.signature).toBe(expected);
  });

  it('fails closed when Cloudinary env is missing', () => {
    delete process.env.CLOUDINARY_API_SECRET;
    expect(() => service.expectedUrlPrefix()).toThrow(
      InternalServerErrorException,
    );
    expect(() => service.signUpload('p1')).toThrow(
      InternalServerErrorException,
    );
  });
});
