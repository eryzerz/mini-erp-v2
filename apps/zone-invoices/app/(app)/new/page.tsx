"use client";

import { InvoiceForm } from "@/components/invoice-form";

export default function NewInvoicePage(): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground">Drafts are editable until sent — the number is assigned on issue.</p>
      </div>
      <InvoiceForm />
    </div>
  );
}
