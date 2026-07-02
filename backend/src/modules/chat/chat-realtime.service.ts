import { Injectable } from '@nestjs/common';

/**
 * Thin wrapper over the Supabase Realtime Broadcast REST API (no SDK — mirrors
 * QStashService/ResendService, keeps the dependency surface at $0). Pushes an admin
 * reply to the customer's PRIVATE channel `chat:user:<userId>` so their widget
 * updates live.
 *
 * The backend is the ONLY broadcaster: it uses the service-role key (which bypasses
 * Realtime RLS for sending), while clients only RECEIVE — an RLS SELECT policy on
 * `realtime.messages` authorizes each customer to their own channel
 * (`topic = 'chat:user:' || auth.uid()`), so no client can listen on another's.
 *
 * Persist-first: this only mirrors an already-persisted message, so a broadcast
 * failure never affects the source of truth. Config is read lazily from env and
 * DEGRADES (skips) when unset — local dev works without the service-role key (the
 * client widget falls back to polling).
 */
@Injectable()
export class ChatRealtimeService {
  isConfigured(): boolean {
    return Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  }

  // Broadcast a payload to a user's private chat channel. Throws on a non-2xx so the
  // caller can log; callers wrap this best-effort so realtime never breaks a
  // persisted reply.
  async broadcastToUser(
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return; // degrade — the client poll fallback covers it

    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic: `chat:user:${userId}`,
            event: 'message',
            payload,
            private: true,
          },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`Supabase broadcast failed (${res.status}).`);
    }
  }
}
