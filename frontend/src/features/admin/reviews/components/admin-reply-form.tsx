'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { useAdminReplyToReview } from '@/features/admin/reviews/hooks/use-admin-reviews';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Admin-only store-reply form, shown under a review that has no reply yet. Shared by
// the product detail page (inline) and the admin reviews list page.
export function AdminReplyForm({ reviewId }: { reviewId: string }) {
  const t = useTranslations('admin');
  const reply = useAdminReplyToReview();
  const [text, setText] = useState('');

  function submit() {
    const value = text.trim();
    if (!value) return;
    reply.mutate(
      { id: reviewId, body: { reply: value } },
      {
        onSuccess: () => {
          toast.success(t('replied'));
          setText('');
        },
        onError: () => toast.error(t('replyError')),
      },
    );
  }

  return (
    <div className="mt-1 flex flex-col items-start gap-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        placeholder={t('replyPlaceholder')}
        className="w-full"
      />
      <Button
        size="sm"
        onClick={submit}
        disabled={!text.trim() || reply.isPending}
      >
        {t('reply')}
      </Button>
    </div>
  );
}
