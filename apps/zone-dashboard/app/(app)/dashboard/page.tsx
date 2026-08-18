"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";

export default function DashboardPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>Revenue, outstanding, overdue and recent invoices will render here.</CardDescription>
        </CardHeader>
        <CardContent>
          The metrics land in the dashboard slice; the shared shell, session and cross-zone nav are live today.
        </CardContent>
      </Card>
    </div>
  );
}
