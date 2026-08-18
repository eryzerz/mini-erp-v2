"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";

export default function InvoicesPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
      <Card>
        <CardHeader>
          <CardTitle>Invoice lifecycle</CardTitle>
          <CardDescription>Draft, send, mark paid and cancel invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          The invoice table, form and lifecycle actions land in the next slice; the shell and cross-zone nav are live today.
        </CardContent>
      </Card>
    </div>
  );
}
