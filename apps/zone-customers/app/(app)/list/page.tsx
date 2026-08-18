"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Card, CardContent, EmptyState, Input, Pagination, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import type { CustomerDto } from "@repo/contracts";
import { useSession } from "@repo/web-shared";

import { CustomerDialog } from "@/components/customer-dialog";
import { formatDate } from "@/lib/format";
import { useCustomers, useDeleteCustomer } from "@/lib/queries";

export default function CustomersPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? 1);
  const search = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);
  const deferredSearch = useDeferredValue(searchInput);
  const { user } = useSession();

  const { data, isLoading, isError } = useCustomers({ page, search: deferredSearch || undefined });
  const deleteMutation = useDeleteCustomer();
  const [deleteTarget, setDeleteTarget] = useState<CustomerDto | null>(null);

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
    // BasePath-relative list route: the router prepends the zone's basePath, so
    // "/list" resolves to /customers/list (the home path 404s RSC fetches at the
    // edge, which would turn these into full page loads).
    router.replace(`/list${str ? `?${str}` : ""}`);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Customer deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete customer");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage the companies and people you invoice</p>
        </div>
        <CustomerDialog
          trigger={
            <Button>
              <Plus /> New customer
            </Button>
          }
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          className="pl-9"
          value={searchInput}
          onChange={(event) => {
            setSearchInput(event.target.value);
            updateQuery({ search: event.target.value, page: undefined });
          }}
        />
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
              Failed to load customers.
            </CardContent>
          ) : data && data.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Tax ID</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">{customer.email ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{customer.phone ?? customer.address ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{customer.taxId ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(customer.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <CustomerDialog
                            customer={customer}
                            trigger={<Button variant="ghost" size="sm">Edit</Button>}
                          />
                          {user?.role === "ADMIN" ? (
                            <Button variant="ghost" size="icon" aria-label={`Delete ${customer.name}`} onClick={() => setDeleteTarget(customer)}>
                              <Trash2 className="text-destructive" />
                            </Button>
                          ) : null}
                        </div>
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
              title="No customers found"
              description={deferredSearch ? "Try a different search term." : "Create your first customer to start invoicing."}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> will be permanently removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
