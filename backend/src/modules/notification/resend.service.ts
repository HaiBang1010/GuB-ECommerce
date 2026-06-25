import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Thin wrapper over the Resend REST API (no SDK — same $0 / no-ESM rationale as
 * QStashService). Config is read lazily from env and DEGRADES (skips) when unset,
 * so local dev never needs an API key. NEVER logs the recipient or body (no PII).
 */
@Injectable()
export class ResendService {
  isConfigured(): boolean {
    return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  }

  // Send a transactional order-status email. The subject/body are generated here
  // in English at send time — they are NOT stored in the DB (the in-app copy is
  // rendered from structured data on the frontend). Throws on a non-2xx so the
  // caller can swallow it (email is best-effort).
  async sendOrderStatusEmail(params: {
    to: string;
    status: OrderStatus;
    orderId: string;
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) return; // degrade
    const { subject, html } = this.render(params.status, params.orderId);
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: params.to, subject, html }),
    });
    if (!res.ok) {
      throw new Error(`Resend send failed (${res.status}).`);
    }
  }

  private render(
    status: OrderStatus,
    orderId: string,
  ): { subject: string; html: string } {
    const shortId = orderId.slice(-8);
    const base = process.env.APP_PUBLIC_URL;
    const link = base ? `${base}/orders/${orderId}` : null;
    const headlines: Partial<Record<OrderStatus, string>> = {
      [OrderStatus.PAID]: 'We received your payment',
      [OrderStatus.SHIPPED]: 'Your order is on the way',
      [OrderStatus.DELIVERED]: 'Your order has been delivered',
    };
    const headline = headlines[status] ?? 'Order update';
    const subject = `GuB · Order #${shortId} — ${headline}`;
    const html =
      `<p>${headline}.</p>` +
      `<p>Order <strong>#${shortId}</strong>` +
      (link ? ` — <a href="${link}">view your order</a>` : '') +
      `.</p>`;
    return { subject, html };
  }
}
