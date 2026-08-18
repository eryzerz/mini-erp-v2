"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { Button, Card, CardContent, EmptyState, Input, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { InvoiceStatus } from "@repo/contracts";

import { AmountText } from "@/components/amount-text";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { useInvoices } from "@/lib/queries";

export default function InvoicesPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? 1);
  const status = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);
  const deferredSearch = useDeferredValue(searchInput);

  const { data, isLoading, isError } = useInvoices({ page, status: status || undefined, search: deferredSearch || undefined });

  const updateQuery = (updates: Record<string, string | undefined>): void => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    const str = params.toString();
    router.replace(`/invoices${str ? `?${str}` : ""}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Create, send, and track invoices</p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus /> New invoice
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by number…"
            className="pl-9"
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              updateQuery({ search: event.target.value, page: undefined });
            }}
          />
        </div>
        <Select
          value={status || "ALL"}
          onValueChange={(value) => updateQuery({ status: value === "ALL" ? undefined : value, page: undefined })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.values(InvoiceStatus).map((value) => (
              <SelectItem key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : isError ? (
            <CardContent className="flex items-center gap-2 p-6 text-sm text-destructive">
              Failed to load invoices.
            </CardContent>
          ) : data && data.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((invoice) => (
                    <TableRow key={invoice.id} className="cursor-pointer" onClick={() => router.push(`/invoices/${invoice.id}`)}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm underline-offset-4 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {invoice.number ?? "Draft"}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.customer?.name}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(invoice.issueDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} overdue={invoice.overdue} />
                      </TableCell>
                      <TableCell className="text-right">
                        <AmountText value={invoice.total} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t p-4">
                <Pagination page={data.page} totalPages={data.totalPages} onChange={(nextPage) => updateQuery({ page: String(nextPage) })} />
              </div>
            </>
          ) : (
            <EmptyState
              className="border-0"
              title="No invoices found"
              description={deferredSearch || status ? "Try different filters." : "Create your first invoice to get started."}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
