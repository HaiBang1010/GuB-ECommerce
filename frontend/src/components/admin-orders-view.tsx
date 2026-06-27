"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { useAdminOrders, useAdminUpdateOrderStatus } from "@/hooks/use-orders";
import { useDebounce } from "@/hooks/use-debounce";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { PaginationBar } from "@/components/admin/pagination-bar";
import {
  NEXT_STATUS,
  OrderDetailDialog,
} from "@/components/admin/order-detail-dialog";
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

export function AdminOrdersView() {
  const t = useTranslations("admin");
  const tStatus = useTranslations("order.status");
  // Empty selection = no ?status filter (every order).
  const [selected, setSelected] = useState<OrderStatus[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // The order whose detail dialog is open (null = closed).
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
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
                          <button
                            type="button"
                            onClick={() => setOpenOrderId(o.id)}
                            className="hover:underline"
                          >
                            #{o.id.slice(-8)}
                          </button>
                        </td>
                        <td className="py-2 pr-4">
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

      <OrderDetailDialog
        orderId={openOrderId}
        initialOrder={
          data?.items.find((o) => o.id === openOrderId) ?? undefined
        }
        onOpenChange={(open) => {
          if (!open) setOpenOrderId(null);
        }}
      />
    </div>
  );
}
