'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { useAdminUsers } from '@/features/admin/users/hooks/use-users';
import { useDebounce } from '@/features/admin/hooks/use-debounce';
import { PaginationBar } from '@/features/admin/components/pagination-bar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/datetime';

export function AdminUsersListView() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const search = useDebounce(searchInput, 300);
  const { isPending, isError, data } = useAdminUsers(search, page, pageSize);

  // Any search / page-size change resets to page 1.
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t('users')}</h1>
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t('searchUsers')}
          className="w-full sm:w-72"
        />
      </div>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t('usersError')}</p>
      ) : (
        <>
          {data.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('noUsers')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 pr-4 font-medium">{t('user')}</th>
                    <th className="py-2 pr-4 font-medium">{t('role')}</th>
                    <th className="py-2 font-medium">{t('joined')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/admin/users/${u.id}`}
                          className="hover:underline"
                        >
                          {u.name ? (
                            <span className="flex flex-col">
                              <span>{u.name}</span>
                              <span className="text-muted-foreground text-xs">
                                {u.email}
                              </span>
                            </span>
                          ) : (
                            <span>{u.email}</span>
                          )}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{u.role}</td>
                      <td className="py-2">{formatDate(u.createdAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
