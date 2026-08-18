"use client";

import { AlertTriangle, ArrowLeft, Loader2, Pencil, Send, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { useSession } from "@repo/web-shared";

import { AmountText } from "@/components/amount-text";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatDateTime } from "@/lib/format";
import { useDeleteInvoice, useInvoice, useInvoiceAction } from "@/lib/queries";

export default function InvoiceDetailPage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const { data: invoice, isLoading, isError } = useInvoice(params.id);
  const actionMutation = useInvoiceAction();
  const deleteMutation = useDeleteInvoice();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"send" | "cancel" | "delete" | null>(null);

  const runAction = async (action: "send" | "mark-paid" | "cancel"): Promise<void> => {
    setPendingAction(action);
    try {
      await actionMutation.mutateAsync({ id: params.id, action });
      toast.success(action === "send" ? "Invoice sent" : action === "mark-paid" ? "Invoice marked as paid" : "Invoice cancelled");
      setConfirmAction(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setPendingAction(null);
    }
  };

  const onDelete = async (): Promise<void> => {
    try {
      await deleteMutation.mutateAsync(params.id);
      toast.success("Invoice deleted");
      setConfirmAction(null);
      router.push("/invoices");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete invoice");
    }
  };

  const confirmCopy: Record<NonNullable<typeof confirmAction>, { title: string; description: string; actionLabel: string; destructive: boolean; busyLabel: string }> = {
    send: {
      title: "Send invoice?",
      description: "The invoice number is assigned now and the draft is frozen — it can no longer be edited.",
      actionLabel: "Send",
      destructive: false,
      busyLabel: "Sending…",
    },
    cancel: {
      title: "Cancel invoice?",
      description: "The invoice stays on record with its status history.",
      actionLabel: "Cancel invoice",
      destructive: true,
      busyLabel: "Cancelling…",
    },
    delete: {
      title: "Delete draft invoice?",
      description: "This draft will be permanently removed. This cannot be undone.",
      actionLabel: "Delete",
      destructive: true,
      busyLabel: "Deleting…",
    },
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> Invoice not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/invoices" aria-label="Back to invoices">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{invoice.number ?? "Draft invoice"}</h1>
              <StatusBadge status={invoice.status} overdue={invoice.overdue} />
            </div>
            <p className="text-sm text-muted-foreground">
              {invoice.customer?.name} · issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.status === "DRAFT" ? (
            <>
              <Button variant="outline" asChild>
                <Link href={`/invoices/${invoice.id}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
              <Button onClick={() => setConfirmAction("send")} disabled={pendingAction !== null}>
                {pendingAction === "send" ? <Loader2 className="animate-spin" /> : <Send />} Send
              </Button>
              <Button variant="outline" onClick={() => setConfirmAction("cancel")} disabled={pendingAction !== null}>
                <XCircle /> Cancel
              </Button>
              {user?.role === "ADMIN" ? (
                <Button variant="destructive" onClick={() => setConfirmAction("delete")} disabled={pendingAction !== null}>
                  <Trash2 /> Delete
                </Button>
              ) : null}
            </>
          ) : null}

          {invoice.status === "SENT" ? (
            <>
              <Button onClick={() => void runAction("mark-paid")} disabled={pendingAction !== null}>
                {pendingAction === "mark-paid" ? <Loader2 className="animate-spin" /> : null} Mark as paid
              </Button>
              <Button variant="outline" onClick={() => setConfirmAction("cancel")} disabled={pendingAction !== null}>
                <XCircle /> Cancel invoice
              </Button>
            </>
          ) : null}

          {invoice.status === "PAID" && invoice.paidAt ? (
            <Badge variant="success" className="h-8 px-3">
              Paid {formatDateTime(invoice.paidAt)}
            </Badge>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Line items</CardTitle>
          <div className="text-sm text-muted-foreground">
            Currency: <span className="font-medium">{invoice.currency}</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="w-20 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Unit price</TableHead>
                <TableHead className="w-20 text-right">PPN</TableHead>
                <TableHead className="w-32 text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoice.items ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    <AmountText value={item.unitPrice} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{item.taxRate}%</TableCell>
                  <TableCell className="text-right font-medium">
                    <AmountText value={item.lineTotal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <AmountText value={invoice.subtotal} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax (PPN)</span>
              <AmountText value={invoice.taxTotal} />
            </div>
            <div className="flex justify-between border-t pt-1 text-base font-semibold">
              <span>Total</span>
              <AmountText value={invoice.total} />
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.history && invoice.history.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l pl-6">
              {invoice.history.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                  <div className="text-sm">
                    <span className="font-medium">
                      {entry.fromStatus ? `${entry.fromStatus.charAt(0) + entry.fromStatus.slice(1).toLowerCase()} → ` : ""}
                      {entry.toStatus.charAt(0) + entry.toStatus.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open && pendingAction === null) {
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction ? confirmCopy[confirmAction].title : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction ? confirmCopy[confirmAction].description : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendingAction !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirmAction ? confirmCopy[confirmAction].destructive ? "destructive" : "default" : "default"}
              disabled={pendingAction !== null}
              onClick={(event) => {
                event.preventDefault();
                if (confirmAction === "delete") {
                  void onDelete();
                } else if (confirmAction === "send" || confirmAction === "cancel") {
                  void runAction(confirmAction);
                }
              }}
            >
              {pendingAction !== null && confirmAction !== null
                ? confirmCopy[confirmAction].busyLabel
                : confirmAction
                  ? confirmCopy[confirmAction].actionLabel
                  : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
