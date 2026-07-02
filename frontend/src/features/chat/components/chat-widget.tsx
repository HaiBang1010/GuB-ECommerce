'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/auth.store';
import { isAdmin } from '@/features/auth/is-admin';
import { useChatUiStore } from '@/stores/chat-ui.store';
import {
  useChatThread,
  useMarkChatRead,
  useSendChatMessage,
} from '@/features/chat/hooks/use-chat';
import { useChatRealtime } from '@/features/chat/hooks/use-chat-realtime';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/datetime';
import type { ChatMessage } from '@/features/chat/api/chat';

// Floating customer-support chat. Mounted storefront-wide (never in the admin shell);
// self-gates to logged-in CUSTOMERS (admins use the admin inbox). Persist-first:
// send/history go through REST; the Realtime Broadcast layer just refetches on an
// admin reply, with a 60s poll as the fallback.
export function ChatWidget() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading || !user || isAdmin(role)) return null;
  return <ChatWidgetInner userId={user.id} />;
}

function ChatWidgetInner({ userId }: { userId: string }) {
  const t = useTranslations('chat');
  const locale = useLocale();
  const isOpen = useChatUiStore((s) => s.isOpen);
  const open = useChatUiStore((s) => s.open);
  const close = useChatUiStore((s) => s.close);

  const { data } = useChatThread();
  const send = useSendChatMessage();
  const markRead = useMarkChatRead();
  useChatRealtime(userId);

  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const messages = data?.messages ?? [];
  const unread = messages.filter((m) => m.sender === 'ADMIN' && !m.readAt).length;

  // Auto-scroll to the newest message when open / when messages change.
  useEffect(() => {
    if (isOpen && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [isOpen, messages.length]);

  // Ack incoming admin messages while the panel is open. `mutate` is referentially
  // stable, so this only re-runs when open/unread actually change (no loop).
  const markReadMutate = markRead.mutate;
  useEffect(() => {
    if (isOpen && unread > 0) markReadMutate();
  }, [isOpen, unread, markReadMutate]);

  function submit() {
    const value = text.trim();
    if (!value || send.isPending) return;
    send.mutate(value, {
      onSuccess: () => setText(''),
      onError: () => toast.error(t('sendError')),
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label={t('launcher')}
        onClick={open}
        className="bg-primary text-primary-foreground fixed right-5 bottom-5 z-50 rounded-full p-3 shadow-lg transition-all duration-300 hover:brightness-110"
      >
        <MessageCircle className="size-5" />
        {unread > 0 ? (
          <span className="bg-destructive text-primary-foreground absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-xs">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <div className="bg-background fixed right-5 bottom-5 z-50 flex h-[28rem] w-80 flex-col rounded-lg border shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-medium">{t('title')}</span>
        <button
          type="button"
          aria-label={t('close')}
          onClick={close}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {t('empty')}
          </p>
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} locale={locale} />)
        )}
      </div>

      <div className="flex items-end gap-2 border-t p-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          maxLength={2000}
          rows={1}
          placeholder={t('placeholder')}
          className="max-h-24 min-h-9 flex-1 resize-none"
        />
        <Button
          size="icon"
          aria-label={t('send')}
          onClick={submit}
          disabled={!text.trim() || send.isPending}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Bubble({ message, locale }: { message: ChatMessage; locale: string }) {
  const t = useTranslations('chat');
  const mine = message.sender === 'USER';
  return (
    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
          mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        {message.body}
      </div>
      <span className="text-muted-foreground mt-0.5 text-[10px]">
        {mine ? t('you') : t('support')} ·{' '}
        {formatDateTime(message.createdAt, locale)}
      </span>
    </div>
  );
}
