'use client';

import { useTranslations } from 'next-intl';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const PAGE_SIZES = [10, 20, 50, 100];

// Page tokens to render: first … current±1 … last (all pages when there are ≤7).
export function pageItems(
  current: number,
  total: number,
): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | 'ellipsis')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push('ellipsis');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push('ellipsis');
  items.push(total);
  return items;
}

// Shared admin pager: rows-per-page dropdown + windowed page navigation. Used by
// the admin orders and admin reviews lists. `total` is the row count over the
// current filter; pages are derived from it.
export function PaginationBar({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) {
  const t = useTranslations('admin');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = pageItems(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t('rowsPerPage')}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {pageSize}
              <ChevronDown className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {PAGE_SIZES.map((s) => (
              <DropdownMenuItem key={s} onClick={() => onPageSize(s)}>
                {s}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">
          {t('pageOf', { page, total: totalPages })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page <= 1}
            onClick={() => onPage(1)}
            aria-label="First page"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </Button>
          {items.map((it, i) =>
            it === 'ellipsis' ? (
              <span
                key={`ellipsis-${i}`}
                className="text-muted-foreground px-1"
              >
                …
              </span>
            ) : (
              <Button
                key={it}
                variant={it === page ? 'default' : 'outline'}
                size="icon"
                className="size-8"
                onClick={() => onPage(it)}
              >
                {it}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page >= totalPages}
            onClick={() => onPage(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled={page >= totalPages}
            onClick={() => onPage(totalPages)}
            aria-label="Last page"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
