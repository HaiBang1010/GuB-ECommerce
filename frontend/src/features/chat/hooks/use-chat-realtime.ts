import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/client';

/**
 * Subscribe to the customer's PRIVATE Realtime channel `chat:user:<userId>` so an
 * admin reply (broadcast server-side after it is persisted) refetches the thread
 * instantly. Persist-first: the broadcast is only a signal — we invalidate and pull
 * the saved truth via REST, so a missed/duplicate/out-of-order event is harmless (the
 * 60s poll also covers it).
 *
 * Authorization is real: the channel is `private`, and an RLS SELECT policy on
 * `realtime.messages` (`topic = 'chat:user:' || auth.uid()`) lets a customer receive
 * only on their own channel. No-op for guests. Realtime only connects against a real
 * Supabase project (deploy) with the policy applied; locally it degrades to the poll.
 */
export function useChatRealtime(userId: string | undefined): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let active = true;
    let channel: RealtimeChannel | undefined;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active || !session) return;
      // Authorize the socket with the current access token for the private channel.
      await supabase.realtime.setAuth(session.access_token);
      if (!active) return;
      channel = supabase
        .channel(`chat:user:${userId}`, { config: { private: true } })
        .on('broadcast', { event: 'message' }, () => {
          void qc.invalidateQueries({ queryKey: ['chat', 'thread'] });
        });
      channel.subscribe();
    })();

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
