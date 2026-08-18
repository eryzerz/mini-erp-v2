"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";

export default function CustomersPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
      <Card>
        <CardHeader>
          <CardTitle>Customer directory</CardTitle>
          <CardDescription>Search, create, update and manage customers.</CardDescription>
        </CardHeader>
        <CardContent>
          The customer table and dialogs land in the next slice; the shell and cross-zone nav are live today.
        </CardContent>
      </Card>
    </div>
  );
}
