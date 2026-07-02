'use client';

import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useDebounce } from '@/features/admin/hooks/use-debounce';
import { PaginationBar } from '@/features/admin/components/pagination-bar';
import {
  useAdminConversation,
  useAdminConversations,
  useAdminReply,
  useMarkAdminConversationRead,
} from '@/features/admin/chat/hooks/use-admin-chat';
import type { AdminChatMessage } from '@/features/admin/chat/api/chat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { formatDateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';

// Admin chat inbox — a split view (conversation list + selected thread). Poll-only:
// the list + the open thread refetch on an interval (no Realtime channel; the admin
// side is poll by design). The customer still gets live updates because an admin
// reply broadcasts server-side (slice 4).
export function AdminChatView() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const search = useDebounce(searchInput, 300);

  const { isPending, isError, data } = useAdminConversations(search, page, pageSize);

  function handleSearch(value: string) {
    setSearchInput(value);
    setPage(1);
  }
  function handlePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t('chat')}</h1>
      <div className="grid gap-4 md:grid-cols-[20rem_1fr]">
        <div className="flex flex-col gap-3">
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('chatSearchPlaceholder')}
          />
          {isPending ? (
            <Skeleton className="h-64 w-full" />
          ) : isError || !data ? (
            <p className="text-destructive text-sm">{t('error')}</p>
          ) : data.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('chatNoConversations')}
            </p>
          ) : (
            <>
              <ul className="flex flex-col gap-1">
                {data.items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'w-full rounded-md border px-3 py-2 text-left text-sm',
                        selectedId === c.id ? 'bg-muted' : 'hover:bg-muted/60',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          {c.customer?.name ??
                            c.customer?.email ??
                            c.userId.slice(-8)}
                        </span>
                        {c.unreadCount > 0 ? (
                          <span className="bg-primary text-primary-foreground flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs">
                            {c.unreadCount}
                          </span>
                        ) : null}
                      </span>
                      {c.customer?.name ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {c.customer.email}
                        </span>
                      ) : null}
                      {c.lastMessageAt ? (
                        <span className="text-muted-foreground block text-xs">
                          {formatDateTime(c.lastMessageAt, locale)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              {data.total > 0 ? (
                <PaginationBar
                  page={page}
                  pageSize={pageSize}
                  total={data.total}
                  onPage={setPage}
                  onPageSize={handlePageSize}
                />
              ) : null}
            </>
          )}
        </div>

        <div className="min-h-[28rem] rounded-md border">
          {selectedId ? (
            <ConversationPanel key={selectedId} conversationId={selectedId} />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <p className="text-muted-foreground text-sm">
                {t('chatSelectPrompt')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationPanel({ conversationId }: { conversationId: string }) {
  const t = useTranslations('admin');
  const { data, isPending, isError } = useAdminConversation(conversationId);
  const reply = useAdminReply();
  const markRead = useMarkAdminConversationRead();

  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const messages = data?.messages ?? [];
  const unread = messages.filter((m) => m.sender === 'USER' && !m.readAt).length;

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Ack the customer's messages while the thread is open (mutate is stable → no loop).
  const markReadMutate = markRead.mutate;
  useEffect(() => {
    if (unread > 0) markReadMutate(conversationId);
  }, [conversationId, unread, markReadMutate]);

  function submit() {
    const value = text.trim();
    if (!value || reply.isPending) return;
    reply.mutate(
      { id: conversationId, body: { body: value } },
      {
        onSuccess: () => setText(''),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t('chatSendError')),
      },
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : isError || !data ? (
          <p className="text-destructive text-sm">{t('error')}</p>
        ) : messages.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            {t('chatEmpty')}
          </p>
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} />)
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
          placeholder={t('chatReplyPlaceholder')}
          className="max-h-24 min-h-9 flex-1 resize-none"
        />
        <Button
          size="icon"
          aria-label={t('chatSend')}
          onClick={submit}
          disabled={!text.trim() || reply.isPending}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: AdminChatMessage }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const mine = message.sender === 'ADMIN';
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
        {mine ? t('chatYou') : t('chatCustomer')} ·{' '}
        {formatDateTime(message.createdAt, locale)}
      </span>
    </div>
  );
}
