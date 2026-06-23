import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash } from 'node:crypto';

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

// Signed params the browser echoes back to Cloudinary on a direct upload.
export type SignedUpload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

/**
 * Thin Cloudinary wrapper: signs direct uploads and deletes assets. The API
 * secret stays here (backend) and is NEVER exposed to the browser — the client
 * only ever receives a per-upload signature.
 *
 * Config is resolved lazily so the app boots without Cloudinary env (Phase 0
 * style); only the image endpoints need it. Fails CLOSED when unset.
 */
@Injectable()
export class CloudinaryService {
  private config(): CloudinaryConfig {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException('Cloudinary is not configured.');
    }
    return {
      cloudName,
      apiKey,
      apiSecret,
      folder: process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'gub/products',
    };
  }

  // Valid secure_urls from our account start with this prefix.
  expectedUrlPrefix(): string {
    return `https://res.cloudinary.com/${this.config().cloudName}/`;
  }

  // Signed params for a direct browser→Cloudinary upload into the product's
  // folder. The signature covers EXACTLY the params the client must send.
  signUpload(productId: string): SignedUpload {
    const { cloudName, apiKey, apiSecret, folder } = this.config();
    const timestamp = Math.floor(Date.now() / 1000);
    const scopedFolder = `${folder}/${productId}`;
    const signature = this.sign({ folder: scopedFolder, timestamp }, apiSecret);
    return { cloudName, apiKey, timestamp, folder: scopedFolder, signature };
  }

  // Delete an asset by public_id (admin API). Throws on a non-OK response so the
  // caller can decide how to handle a remote failure.
  async destroy(publicId: string): Promise<void> {
    const { cloudName, apiKey, apiSecret } = this.config();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.sign({ public_id: publicId, timestamp }, apiSecret);
    const body = new URLSearchParams({
      public_id: publicId,
      api_key: apiKey,
      timestamp: String(timestamp),
      signature,
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body },
    );
    if (!response.ok) {
      throw new Error(
        `Cloudinary destroy failed with status ${response.status}.`,
      );
    }
  }

  // Cloudinary signature: sha1 of the sorted "k=v&k=v" param string + api_secret.
  private sign(
    params: Record<string, string | number>,
    apiSecret: string,
  ): string {
    const toSign = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1')
      .update(toSign + apiSecret)
      .digest('hex');
  }
}
