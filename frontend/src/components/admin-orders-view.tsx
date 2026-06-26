"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";

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

export function AdminOrdersView() {
  const t = useTranslations("admin");
  const tStatus = useTranslations("order.status");
  // Empty selection = no ?status filter (every order).
  const [selected, setSelected] = useState<OrderStatus[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput, 300);
  const { isPending, isError, data } = useAdminOrders(selected, search);
  const advance = useAdminUpdateOrderStatus();

  function toggleStatus(s: OrderStatus) {
    setSelected((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
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
            onChange={(e) => setSearchInput(e.target.value)}
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
                  <DropdownMenuItem onClick={() => setSelected([])}>
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
      ) : data.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("noOrders")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 pr-4 font-medium">{t("orderId")}</th>
                <th className="py-2 pr-4 font-medium">{t("user")}</th>
                <th className="py-2 pr-4 font-medium">{t("statusColumn")}</th>
                <th className="py-2 pr-4 font-medium">{t("total")}</th>
                <th className="py-2 font-medium">{t("action")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => {
                const next = NEXT_STATUS[o.status];
                return (
                  <tr key={o.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-mono">#{o.id.slice(-8)}</td>
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
                    <td className="py-2 pr-4">{formatPriceCents(o.totalCents)}</td>
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
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
