"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@repo/ui";

import { InvoiceForm } from "@/components/invoice-form";
import { useInvoice } from "@/lib/queries";

export default function EditInvoicePage(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const { data: invoice, isLoading, isError } = useInvoice(params.id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> Invoice not found.
        </CardContent>
      </Card>
    );
  }

  if (invoice.status !== "DRAFT") {
    return (
      <Card>
        <CardContent className="p-6 text-sm">
          Only draft invoices can be edited — <span className="font-medium">{invoice.number}</span> is already issued.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit draft invoice</h1>
        <p className="text-sm text-muted-foreground">Changes are saved back to the draft.</p>
      </div>
      <InvoiceForm invoice={invoice} />
    </div>
  );
}
