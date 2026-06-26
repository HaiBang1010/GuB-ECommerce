"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Link } from "@/i18n/navigation";
import { useAdminOrders, useAdminUpdateOrderStatus } from "@/hooks/use-orders";
import { useDebounce } from "@/hooks/use-debounce";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api/client";
import { formatPriceCents } from "@/lib/money";
import type { OrderStatus } from "@/lib/api/orders";

// The single admin-driven fulfillment chain. The backend ADMIN_TRANSITIONS is
// authoritative — this only decides which advance button to show; an illegal step
// is still rejected server-side.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PAID: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
};

// All order statuses, for the filter checkboxes. OrderStatus is a generated union
// (no runtime enum), so the list is spelled out; labels reuse order.status.*.
const STATUSES: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const PAGE_SIZES = [10, 20, 50, 100];

// Page tokens to render: first … current±1 … last (all pages when there are ≤7).
function pageItems(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("ellipsis");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push("ellipsis");
  items.push(total);
  return items;
}

export function AdminOrdersView() {
  const t = useTranslations("admin");
  const tStatus = useTranslations("order.status");
  // Empty selection = no ?status filter (every order).
  const [selected, setSelected] = useState<OrderStatus[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const search = useDebounce(searchInput, 300);
  const { isPending, isError, data } = useAdminOrders(
    selected,
    search,
    page,
    pageSize,
  );
  const advance = useAdminUpdateOrderStatus();

  // Any filter/search/page-size change resets to page 1 so we never land on a
  // page that no longer exists.
  function toggleStatus(s: OrderStatus) {
    setSelected((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
    setPage(1);
  }

  function clearStatuses() {
    setSelected([]);
    setPage(1);
  }

  function handleSearch(value: string) {
    setSearchInput(value);
    setPage(1);
  }

  function handlePageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  function handleAdvance(id: string, next: OrderStatus) {
    advance.mutate(
      { id, body: { status: next } },
      {
        onSuccess: () => toast.success(t("statusUpdated")),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : t("updateError")),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("orders")}</h1>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full sm:w-72"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {t("filterByStatus")}
                {selected.length > 0 ? ` (${selected.length})` : ""}
                <ChevronDown className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {STATUSES.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={selected.includes(s)}
                  onCheckedChange={() => toggleStatus(s)}
                  // Keep the menu open so multiple statuses can be toggled at once.
                  onSelect={(e) => e.preventDefault()}
                >
                  {tStatus(s)}
                </DropdownMenuCheckboxItem>
              ))}
              {selected.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={clearStatuses}>
                    {t("filterClear")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <p className="text-destructive text-sm">{t("error")}</p>
      ) : (
        <>
          {data.items.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noOrders")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b text-left">
                    <th className="py-2 pr-4 font-medium">{t("orderId")}</th>
                    <th className="py-2 pr-4 font-medium">{t("user")}</th>
                    <th className="py-2 pr-4 font-medium">
                      {t("statusColumn")}
                    </th>
                    <th className="py-2 pr-4 font-medium">{t("total")}</th>
                    <th className="py-2 font-medium">{t("action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => {
                    const next = NEXT_STATUS[o.status];
                    return (
                      <tr key={o.id} className="border-b last:border-b-0">
                        <td className="py-2 pr-4 font-mono">
                          #{o.id.slice(-8)}
                        </td>
                        <td className="py-2 pr-4">
                          {/* /admin/users/[id] is a placeholder route (404 for now). */}
                          <Link
                            href={`/admin/users/${o.userId}`}
                            className="hover:underline"
                          >
                            {o.customer?.name ? (
                              <span className="flex flex-col">
                                <span>{o.customer.name}</span>
                                <span className="text-muted-foreground text-xs">
                                  {o.customer.email}
                                </span>
                              </span>
                            ) : (
                              <span>
                                {o.customer?.email ?? o.userId.slice(-8)}
                              </span>
                            )}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">
                          <OrderStatusBadge status={o.status} />
                        </td>
                        <td className="py-2 pr-4">
                          {formatPriceCents(o.totalCents)}
                        </td>
                        <td className="py-2">
                          {next ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={advance.isPending}
                              onClick={() => handleAdvance(o.id, next)}
                            >
                              {t("advanceTo", { status: tStatus(next) })}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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

function PaginationBar({
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
  const t = useTranslations("admin");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = pageItems(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("rowsPerPage")}</span>
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
          {t("pageOf", { page, total: totalPages })}
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
            it === "ellipsis" ? (
              <span
                key={`ellipsis-${i}`}
                className="text-muted-foreground px-1"
              >
                …
              </span>
            ) : (
              <Button
                key={it}
                variant={it === page ? "default" : "outline"}
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
