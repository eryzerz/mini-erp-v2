"use client";

import { Plus, Search, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, CardContent, EmptyState, Input, Pagination, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import type { UserDto } from "@repo/contracts";
import { RoleGate } from "@repo/web-shell";
import { UserRole } from "@repo/contracts";
import { useSession } from "@repo/web-shared";

import { UserDialog } from "@/components/user-dialog";
import { formatDate } from "@/lib/format";
import { useUsers, useDeleteUser } from "@/lib/queries";

export default function UsersPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? 1);
  const search = searchParams.get("search") ?? "";
  const [searchInput, setSearchInput] = useState(search);
  const deferredSearch = useDeferredValue(searchInput);
  const { user: currentUser } = useSession();

  const { data, isLoading, isError } = useUsers({ page, search: deferredSearch || undefined });
  const deleteMutation = useDeleteUser();
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);

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
    router.replace(`/users${str ? `?${str}` : ""}`);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("User deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    }
  };

  return (
    <RoleGate roles={[UserRole.ADMIN]} fallback="/dashboard">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
            <p className="text-sm text-muted-foreground">Manage who can sign in to the system</p>
          </div>
          <UserDialog
            trigger={
              <Button>
                <Plus /> New user
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
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : isError ? (
              <CardContent className="flex items-center gap-2 p-6 text-sm text-destructive">
                Failed to load users.
              </CardContent>
            ) : data && data.items.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name}
                          {user.id === currentUser?.id ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(user.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <UserDialog user={user} trigger={<Button variant="ghost" size="sm">Edit</Button>} />
                            {user.id !== currentUser?.id ? (
                              <Button variant="ghost" size="icon" aria-label={`Delete ${user.name}`} onClick={() => setDeleteTarget(user)}>
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
                title="No users found"
                description={deferredSearch ? "Try a different search term." : "Create your first user to get started."}
              />
            )}
          </CardContent>
        </Card>

        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="font-medium text-foreground">{deleteTarget?.name}</span> will lose access to the
                system. This cannot be undone.
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
    </RoleGate>
  );
}
