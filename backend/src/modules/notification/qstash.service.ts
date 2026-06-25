import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { jwtVerify } from 'jose';

const QSTASH_PUBLISH_URL = 'https://qstash.upstash.io/v2/publish';

/**
 * Thin wrapper over the Upstash QStash REST API (no SDK — avoids the ESM/CommonJS
 * friction that bit `jose` v6, and keeps the dependency surface at $0). Tokens
 * never leave the backend. Config is read lazily from env.
 *
 * Publish DEGRADES (skips) when unconfigured so the order flow + local dev work
 * without QStash credentials. Verification FAILS CLOSED — an unverifiable public
 * endpoint must reject.
 */
@Injectable()
export class QStashService {
  isPublishConfigured(): boolean {
    return Boolean(process.env.QSTASH_TOKEN && process.env.QSTASH_CONSUMER_URL);
  }

  // Publish a JSON event to QStash, which delivers it (with retries + an
  // Upstash-Signature) to our consumer URL. Throws on a non-2xx so the caller can
  // decide; producers wrap this best-effort so a publish failure never breaks an order.
  async publish(event: unknown): Promise<void> {
    const token = process.env.QSTASH_TOKEN;
    const consumerUrl = process.env.QSTASH_CONSUMER_URL;
    if (!token || !consumerUrl) return; // degrade
    const res = await fetch(`${QSTASH_PUBLISH_URL}/${consumerUrl}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      throw new Error(`QStash publish failed (${res.status}).`);
    }
  }

  // Verify the `Upstash-Signature` JWT (HS256 over a signing key) against the raw
  // body. Tries the current then the next key (QStash rotates). Throws on any
  // failure — fails closed. The JWT's `body` claim is the base64url SHA-256 of the
  // raw request body, which pins the payload to the signature.
  async verify(rawBody: Buffer, signature: string | undefined): Promise<void> {
    if (!signature) {
      throw new Error('Missing Upstash-Signature header.');
    }
    const keys = [
      process.env.QSTASH_CURRENT_SIGNING_KEY,
      process.env.QSTASH_NEXT_SIGNING_KEY,
    ].filter((k): k is string => Boolean(k));
    if (keys.length === 0) {
      throw new Error('QStash signing keys are not configured.');
    }
    const bodyHash = createHash('sha256').update(rawBody).digest('base64url');
    for (const key of keys) {
      try {
        const { payload } = await jwtVerify(
          signature,
          new TextEncoder().encode(key),
        );
        const claimBody =
          typeof payload.body === 'string' ? payload.body : '';
        // Compare padding-insensitively (QStash emits unpadded base64url).
        if (
          claimBody.replace(/=+$/, '') === bodyHash.replace(/=+$/, '')
        ) {
          return;
        }
      } catch {
        // Wrong key or expired token — try the next signing key.
      }
    }
    throw new Error('Invalid QStash signature.');
  }
}
