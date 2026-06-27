'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { useAdminReviews } from '@/hooks/use-reviews';
import { AdminReplyForm } from '@/components/admin/admin-reply-form';
import { PaginationBar } from '@/features/admin/components/pagination-bar';
import { StarRating } from '@/components/star-rating';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDateTime } from '@/lib/datetime';

type ReplyFilter = 'all' | 'unreplied' | 'replied';

// Map the UI filter to the backend ?replied param (omitted = all).
const REPLIED_PARAM: Record<ReplyFilter, boolean | undefined> = {
  all: undefined,
  unreplied: false,
  replied: true,
};

const FILTERS: ReplyFilter[] = ['all', 'unreplied', 'replied'];

export function AdminReviewsView() {
  const t = useTranslations('admin');
  const tReview = useTranslations('reviews');
  const locale = useLocale();
  const [filter, setFilter] = useState<ReplyFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { isPending, isError, data } = useAdminReviews(
    page,
    pageSize,
    REPLIED_PARAM[filter],
  );

  // Any filter / page-size change resets to page 1.
  function handleFilter(next: ReplyFilter) {
    setFilter(next);
    setPage(1);
  }
  function handlePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  const filterLabel: Record<ReplyFilter, string> = {
    all: t('filterAll'),
    unreplied: t('unreplied'),
    replied: t('filterReplied'),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('reviewsTitle')}</h1>
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <Button
              key={f}
              variant={f === filter ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilter(f)}
            >
              {filterLabel[f]}
            </Button>
          ))}
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t('reviewsError')}</p>
      ) : (
        <>
          {data.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('noReviewsFound')}
            </p>
          ) : (
            <ul className="flex flex-col gap-4">
              {data.items.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-1 rounded-md border p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {r.product
                        ? locale === 'vi'
                          ? r.product.nameVi
                          : r.product.nameEn
                        : t('unknownProduct')}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatDate(r.createdAt, locale)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StarRating value={r.rating} readOnly size={16} />
                    <span className="text-muted-foreground text-xs">
                      {r.reviewer?.name ?? r.reviewer?.email ?? t('anonymous')}
                    </span>
                  </div>
                  {r.body ? <p className="text-sm">{r.body}</p> : null}
                  {r.adminReply ? (
                    <div className="bg-muted/60 mt-1 rounded-md p-3">
                      <p className="text-xs font-medium">
                        {tReview('storeReply')}
                      </p>
                      <p className="text-sm">{r.adminReply}</p>
                      {r.adminReplyAt ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {formatDateTime(r.adminReplyAt, locale)}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <AdminReplyForm reviewId={r.id} />
                  )}
                </li>
              ))}
            </ul>
          )}

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
  );
}
