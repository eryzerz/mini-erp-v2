"use client";

import { AlertTriangle, Banknote, Clock } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn } from "@repo/ui";
import { Chart } from "@repo/ui/chart";
import { ZONE_BASE } from "@repo/web-shell";

import { AmountText } from "@/components/amount-text";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { useDashboard } from "@/lib/queries";

const PERIODS = [
  { label: "All time", from: undefined },
  { label: "60 days", from: "60" },
  { label: "180 days", from: "180" },
];

export default function DashboardPage(): React.ReactElement {
  const searchParams = useSearchParams();
  const periodDays = searchParams.get("period");

  const from = useMemo(() => {
    if (!periodDays) return undefined;
    const date = new Date();
    date.setDate(date.getDate() - Number(periodDays));
    return date.toISOString().slice(0, 10);
  }, [periodDays]);

  const { data, isLoading, isError } = useDashboard({ from });

  const chartData = useMemo(() => {
    const months = (data?.monthlyRevenue ?? []).map((row) => ({
      month: row.month,
      revenue: Number(row.revenue),
    }));
    const defaultMonths = 6;
    if (months.length < defaultMonths) {
      const existing = new Set(months.map((m) => m.month));
      const now = new Date();
      for (let i = defaultMonths - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!existing.has(key)) {
          months.push({ month: key, revenue: 0 });
        }
      }
      return months.sort((a, b) => a.month.localeCompare(b.month));
    }
    return months;
  }, [data?.monthlyRevenue]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Invoicing health at a glance</p>
        </div>
        <div className="flex rounded-lg border bg-card p-1">
          {PERIODS.map((period) => (
            <Link
              key={period.label}
              href={period.from ? `/dashboard?period=${period.from}` : "/dashboard"}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                (period.from ?? undefined) === periodDays || (!period.from && !periodDays)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              {period.label}
            </Link>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : null}

      {isError ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" /> Failed to load the dashboard.
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Revenue" value={<AmountText value={data.revenue} />} icon={Banknote} tone="success" />
            <StatCard label="Outstanding" value={<AmountText value={data.outstanding} />} icon={Clock} tone="warning" />
            <StatCard label="Overdue" value={<AmountText value={data.overdue} />} icon={AlertTriangle} tone="danger" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="min-w-0 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Monthly revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <Chart data={chartData} dataKey="revenue" />
              </CardContent>
            </Card>

            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-base">By status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { status: "DRAFT" as const, count: data.countsByStatus.DRAFT, label: "Draft" },
                  { status: "SENT" as const, count: data.countsByStatus.SENT, label: "Sent" },
                  { status: "PAID" as const, count: data.countsByStatus.PAID, label: "Paid" },
                  { status: "CANCELLED" as const, count: data.countsByStatus.CANCELLED, label: "Cancelled" },
                ].map((row) => (
                  <div key={row.status} className="flex items-center justify-between">
                    <StatusBadge status={row.status} />
                    <span className="text-sm font-medium">{row.count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Recent invoices</CardTitle>
              <Button asChild variant="outline" size="sm">
                {/* The invoices list lives in its own zone (ticket 07). */}
                <Link href={`${ZONE_BASE.invoices}`}>View all</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.number ?? "Draft"}</TableCell>
                      <TableCell>{invoice.customer?.name}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} overdue={invoice.overdue} />
                      </TableCell>
                      <TableCell className="text-right">
                        <AmountText value={invoice.total} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.recentInvoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        <Badge variant="secondary">No invoices yet</Badge>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
